// 전역 변수로 이미 정의되었는지 확인
if (typeof window.quizGeneratorInitialized === 'undefined') {
  window.quizGeneratorInitialized = true;

class QuizGenerator {
  constructor() {
    try {
      // 0. 메인 페이지 확인
      this.mainPage = this.isMainPage();
      if (this.mainPage) {
        console.log('메인 페이지에서는 퀴즈 시스템을 초기화하지 않습니다.');
        return;
      }
      
      // 1. 먼저 UI 요소 초기화 (어떤 경우에도 실행되어야 함)
      this.initializeEvents();
      
      // 2. API 키 설정 (기본값 설정)
      this.apiKey = "AIzaSyASPd5qXjOJk9w8H8DksyaWyKlKfw1SBFI";
      
      // 3. API 키를 여러 소스에서 가져오기 시도
      try {
        // 메타 태그에서 가져오기
        const metaApiKey = document.querySelector('meta[name="gemini-api-key"]');
        if (metaApiKey && metaApiKey.content && metaApiKey.content.length > 10) {
          this.apiKey = metaApiKey.content;
          console.log('Using API key from meta tag');
        } 
        // 전역 변수에서 가져오기
        else if (window.GEMINI_API_KEY && window.GEMINI_API_KEY.length > 10) {
          this.apiKey = window.GEMINI_API_KEY;
          console.log('Using API key from global variable');
        }
        // .env 파일의 내용이 JavaScript 변수로 로드된 경우
        else if (process?.env?.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10) {
          this.apiKey = process.env.GOOGLE_API_KEY;
          console.log('Using API key from environment variable');
        } else {
          console.log('Using hardcoded API key as fallback');
        }
      } catch (keyError) {
        // API 키 탐색 중 오류가 발생해도 기본값으로 진행
        console.warn('Error while looking for API key, using fallback:', keyError);
      }
      
      // 4. API 엔드포인트 설정
      this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
      
      // 5. 데이터 초기화
      this.posts = [];
      this.currentQuiz = null;
      this.currentQuizIndex = 0;
      this.quizzes = [];
      
      // 6. 이미 풀었던 퀴즈 추적
      this.loadCompletedQuizzes();
      
      // 7. 포스트 데이터 로드
      this.loadPosts();
    } catch (error) {
      console.error('QuizGenerator initialization failed:', error);
      this.showError('퀴즈 시스템을 초기화하는데 실패했습니다: ' + error.message);
    }
  }

  // 메인 페이지인지 확인하는 함수
  isMainPage() {
    // 기본 홈페이지 경로 확인
    if (window.location.pathname === '/' || 
        window.location.pathname === '/index.html' || 
        window.location.pathname === '/index') {
      return true;
    }
    
    // 메타 태그나 body 클래스를 통한 추가 확인
    const bodyClasses = document.body.className || '';
    if (bodyClasses.includes('home') || bodyClasses.includes('front-page')) {
      return true;
    }
    
    // 제목 확인 (홈페이지는 보통 사이트 이름만 있음)
    const pageTitle = document.title || '';
    const siteTitle = document.querySelector('meta[property="og:site_name"]')?.content || '';
    if (pageTitle === siteTitle) {
      return true;
    }
    
    return false;
  }

  // 풀었던 퀴즈 로드
  loadCompletedQuizzes() {
    try {
      this.completedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes')) || {};
      
      // 현재 IP 주소 기반 퀴즈 히스토리 확인
      if (!this.completedQuizzes.ipTracking) {
        this.completedQuizzes.ipTracking = {};
      }
      
      // IP 주소 가져오기
      this.getClientIP().then(ip => {
        this.clientIP = ip;
        if (!this.completedQuizzes.ipTracking[ip]) {
          this.completedQuizzes.ipTracking[ip] = {
            questions: {},
            lastGenerated: Date.now()
          };
        }
        console.log(`Quiz history loaded for IP: ${ip.substring(0, 5)}...`);
      }).catch(err => {
        console.warn('Failed to get client IP:', err);
        // 폴백: 고유 브라우저 ID 사용
        this.clientIP = this.getBrowserFingerprint();
      });
    } catch (error) {
      console.warn('Failed to load completed quizzes, starting new history:', error);
      this.completedQuizzes = {
        ipTracking: {}
      };
    }
  }
  
  // IP 주소 가져오기 (외부 API 사용)
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) throw new Error('IP 조회 실패');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // 실패 시 브라우저 정보로 고유 ID 생성
      return this.getBrowserFingerprint();
    }
  }
  
  // 브라우저 지문 생성 (IP 조회 실패시 폴백)
  getBrowserFingerprint() {
    // 간단한 브라우저 지문 생성
    const browser = navigator.userAgent + navigator.language + navigator.platform;
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timezone = new Date().getTimezoneOffset();
    
    // 문자열 해시 간단 구현
    let hash = 0;
    const fingerprint = browser + screenInfo + timezone;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    
    return 'browser-' + Math.abs(hash).toString(16);
  }
  
  // 퀴즈 해시 생성
  getQuizHash(question) {
    // 질문의 핵심 키워드 추출 후 해시 생성 (더 안정적인 유사성 검사)
    const keywords = this.extractKeyQuizTerms(question);
    const keywordStr = keywords.join(' ');
    
    let hash = 0;
    for (let i = 0; i < keywordStr.length; i++) {
      const char = keywordStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; 
    }
    return Math.abs(hash).toString(16);
  }
  
  // 퀴즈에서 핵심 용어 추출
  extractKeyQuizTerms(question) {
    // 특수문자 제거 및 소문자화
    const cleanText = question.toLowerCase()
      .replace(/[.,?!:;"'()]/g, '')
      .replace(/\s+/g, ' ');
    
    // 불용어 목록
    const stopWords = ['무엇', '이것', '것은', '다음', '중에서', '대한', '설명', '올바른', '가장', '어떤', '주요', '의미', '하는', 
                      '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과', '이나', '또는', '설명하', 
                      '대하', '하기', '위한', '적인', '것이', '수', '통해', '그', '저', '있', '없'];
    
    // 도메인 특화 중요 용어
    const importantTerms = ['데이터', '웨어하우스', '레이크', '클라우드', 'ai', '머신러닝', '딥러닝', '서버리스', '파이프라인', 
                           'etl', 'aws', 'azure', 'gcp', '마이크로서비스', '컨테이너', '인공지능', '알고리즘'];
    
    // 단어 분리 및 필터링
    const words = cleanText.split(' ')
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // 중요 용어 우선 포함
    const keyTerms = words.filter(word => 
      importantTerms.some(term => word.includes(term)) || word.length > 3);
    
    // 충분한 용어가 없으면 기본 단어들 추가
    if (keyTerms.length < 3) {
      return [...keyTerms, ...words.filter(w => !keyTerms.includes(w))].slice(0, 5);
    }
    
    return keyTerms.slice(0, 5); // 최대 5개 핵심 용어만 사용
  }

  // 특정 질문이 이미 출제된 적이 있는지 확인
  isQuizAlreadySeen(question) {
    if (!this.clientIP || !this.completedQuizzes.ipTracking[this.clientIP]) {
      return false;
    }
    
    const questionHash = this.getQuizHash(question);
    
    // 완전히 동일한 문제인지 확인
    if (this.completedQuizzes.ipTracking[this.clientIP].questions[questionHash]) {
      return true;
    }
    
    // 유사한 문제인지 확인 (내용 기반 유사성 검사)
    const questionLower = question.toLowerCase();
    const storedQuestions = Object.values(this.completedQuizzes.ipTracking[this.clientIP].questions);
    
    // 유사한 문제 검사를 위한 임계값 (0.7 = 70% 유사도)
    const similarityThreshold = 0.7;
    
    for (const storedQ of storedQuestions) {
      if (storedQ.question) {
        const similarity = this.calculateSimilarity(questionLower, storedQ.question.toLowerCase());
        if (similarity > similarityThreshold) {
          console.log(`유사한 문제 감지 (${Math.round(similarity * 100)}% 유사): ${storedQ.question}`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  // 두 문자열의 유사도 계산 (단어 기반 자카드 유사도)
  calculateSimilarity(str1, str2) {
    // 주요 단어만 추출 (불용어 제거)
    const stopWords = ['무엇', '이것', '것은', '다음', '중에서', '대한', '설명', '올바른', '가장', '어떤', '주요', '의미', '하는', 
                      '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과', '이나', '또는'];
    
    // 문장에서 단어 추출
    const getWords = (text) => {
      return text.split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word))
        .map(word => word.replace(/[.,?!:;()]/g, ''));
    };
    
    const words1 = getWords(str1);
    const words2 = getWords(str2);
    
    // 단어 중요도 가중치 적용
    const importantTerms = ['데이터', '웨어하우스', '레이크', '클라우드', 'ai', '머신러닝', '딥러닝', 
                           '서버리스', '파이프라인', 'etl', 'aws', 'azure', 'gcp', '마이크로서비스', 
                           '컨테이너', '인공지능', '알고리즘'];
    
    // 중요 용어에 가중치 부여
    const getWeightedTerms = (words) => {
      const result = new Set();
      words.forEach(word => {
        result.add(word);
        // 중요 용어가 포함된 단어는 두 번 추가하여 가중치 부여
        if (importantTerms.some(term => word.includes(term))) {
          result.add(word);
        }
      });
      return result;
    };
    
    // 단어 세트로 변환
    const set1 = getWeightedTerms(words1);
    const set2 = getWeightedTerms(words2);
    
    // 교집합 계산
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    
    // 합집합 계산
    const union = new Set([...set1, ...set2]);
    
    // 자카드 유사도 계산 (교집합 크기 / 합집합 크기)
    return intersection.size / union.size;
  }
  
  // 풀었던 퀴즈 기록
  markQuizAsCompleted(question) {
    if (!this.clientIP) return;
    
    const questionHash = this.getQuizHash(question);
    
    if (!this.completedQuizzes.ipTracking[this.clientIP]) {
      this.completedQuizzes.ipTracking[this.clientIP] = {
        questions: {},
        lastGenerated: Date.now()
      };
    }
    
    this.completedQuizzes.ipTracking[this.clientIP].questions[questionHash] = {
      timestamp: Date.now(),
      question: question
    };
    
    // 너무 오래된 기록은 제거 (30일)
    this.cleanupOldQuizzes();
    
    // 로컬 스토리지에 저장
    localStorage.setItem('completedQuizzes', JSON.stringify(this.completedQuizzes));
  }
  
  // 오래된 퀴즈 기록 정리 (30일 이상 지난 기록)
  cleanupOldQuizzes() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    Object.keys(this.completedQuizzes.ipTracking).forEach(ip => {
      // 30일 이상 접속하지 않은 IP는 기록 제거
      if (this.completedQuizzes.ipTracking[ip].lastGenerated < thirtyDaysAgo) {
        delete this.completedQuizzes.ipTracking[ip];
        return;
      }
      
      // 개별 문제 중 30일 이상 지난 것 제거
      const questions = this.completedQuizzes.ipTracking[ip].questions;
      Object.keys(questions).forEach(qHash => {
        if (questions[qHash].timestamp < thirtyDaysAgo) {
          delete questions[qHash];
        }
      });
    });
  }

  async loadPosts() {
    try {
      // 페이지에서 직접 포스트 내용 가져오기
      const postElements = document.querySelectorAll('.page__content');
      if (postElements.length > 0) {
        this.posts = Array.from(postElements).map(post => {
          const categoryElements = post.closest('article')?.querySelectorAll('.page__taxonomy-item');
          const categories = categoryElements ? 
            Array.from(categoryElements).map(cat => cat.textContent.trim()) : 
            [];
          
          return {
            title: post.closest('article')?.querySelector('.page__title')?.textContent.trim() || 'Untitled',
            content: post.textContent.trim(),
            categories: categories,
            url: window.location.href
          };
        });
      } else {
        // posts.json에서 가져오기 시도
        const response = await fetch('/api/posts.json');
        if (!response.ok) {
          throw new Error('포스트를 찾을 수 없습니다');
        }
        const data = await response.json();
        this.posts = data.posts.map(post => ({
          ...post,
          categories: [post.category].filter(Boolean)
        }));
      }

      console.log('Posts loaded:', this.posts.length);
      if (this.posts.length === 0) {
        throw new Error('사용 가능한 포스트가 없습니다');
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      this.showError('포스트를 불러오는데 실패했습니다.');
    }
  }

  // 임의의 퀴즈 생성 (Gemini API 호출에 실패할 경우 대체 사용)
  generateLocalQuiz(topic) {
    // 태그나 제목에 따라 다른 퀴즈 생성
    const topicLower = topic ? topic.toLowerCase() : '';
    
    // AI 관련 퀴즈
    if (topicLower.includes('ai') || topicLower.includes('인공지능') || topicLower.includes('머신러닝') || topicLower.includes('딥러닝')) {
      return {
        quizzes: [
          {
            question: "머신러닝에서 과적합(Overfitting)을 방지하는 방법으로 적절하지 않은 것은?",
            options: ["데이터 증강(Data Augmentation)", "드롭아웃(Dropout) 적용", "정규화(Regularization) 사용", "훈련 데이터를 줄이기"],
            correct: 3,
            explanation: "과적합 방지에는 데이터 증강, 드롭아웃, 정규화 등이 효과적이지만, 훈련 데이터를 줄이는 것은 오히려 모델의 일반화 능력을 감소시킬 수 있습니다. 충분한 훈련 데이터는 모델이 다양한 패턴을 학습하는 데 중요하며, 데이터가 부족할 경우 과소적합(Underfitting)이 발생할 위험이 있습니다."
          },
          {
            question: "생성형 AI에서 '환각(Hallucination)' 현상이란?",
            options: ["모델이 사실이 아닌 내용을 사실인 것처럼 생성하는 현상", "모델의 학습 속도가 극도로 느려지는 현상", "모델이 입력 데이터를 완전히 무시하는 현상", "모델이 너무 단순한 출력만 생성하는 현상"],
            correct: 0,
            explanation: "생성형 AI에서 '환각(Hallucination)'은 모델이 학습 데이터에 없거나 사실이 아닌 정보를 마치 사실인 것처럼 자신감 있게 생성하는 현상을 말합니다. 이는 LLM(대규모 언어 모델)과 같은 생성형 AI 시스템의 주요 한계 중 하나로, 신뢰할 수 있는 AI 시스템 개발에 있어 중요한 해결 과제입니다."
          },
          {
            question: "트랜스포머(Transformer) 아키텍처의 핵심 구성 요소는?",
            options: ["RNN 레이어", "셀프 어텐션(Self-Attention) 메커니즘", "컨볼루션 레이어", "MaxPooling 레이어"],
            correct: 1,
            explanation: "트랜스포머 아키텍처의 핵심은 셀프 어텐션(Self-Attention) 메커니즘입니다. 이 메커니즘은 시퀀스의 각 위치가 다른 모든 위치와 관련성을 계산할 수 있게 해주며, 병렬 처리가 가능하여 RNN보다 효율적입니다. BERT, GPT 등 현대적인 언어 모델들은 이 트랜스포머 아키텍처를 기반으로 합니다."
          },
          {
            question: "인공지능 모델 학습에서 '손실 함수(Loss Function)'의 주요 목적은?",
            options: ["모델의 크기를 최소화하는 것", "모델의 예측과 실제 값 사이의 차이를 측정하는 것", "학습 데이터셋의 크기를 결정하는 것", "모델의 학습 속도를 높이는 것"],
            correct: 1,
            explanation: "손실 함수(Loss Function)는 모델의 예측값과 실제 값(레이블) 사이의 차이를 수치화하여 모델의 성능을 평가합니다. 경사 하강법(Gradient Descent)과 같은 최적화 알고리즘은 이 손실 함수를 최소화하는 방향으로 모델의 파라미터를 조정하며, 이를 통해 모델은 점차 정확한 예측을 할 수 있게 됩니다."
          },
          {
            question: "다음 중 비지도 학습(Unsupervised Learning) 알고리즘이 아닌 것은?",
            options: ["K-평균 군집화(K-means clustering)", "결정 트리(Decision Tree)", "주성분 분석(PCA)", "오토인코더(Autoencoder)"],
            correct: 1,
            explanation: "결정 트리(Decision Tree)는 지도 학습(Supervised Learning) 알고리즘입니다. 레이블이 있는 데이터를 사용하여 입력 특성과 출력 레이블 간의 관계를 학습합니다. K-평균 군집화, 주성분 분석, 오토인코더는 모두 레이블 없이 데이터의 패턴이나 구조를 찾는 비지도 학습 알고리즘입니다."
          }
        ]
      };
    }
    // 데이터 관련 퀴즈
    else if (topicLower.includes('data') || topicLower.includes('데이터') || topicLower.includes('분석')) {
      return {
        quizzes: [
          {
            question: "데이터 레이크의 주요 특징으로 올바른 것은?",
            options: ["구조화된 데이터만 저장 가능하다", "실시간 처리에 최적화되어 있다", "모든 형태의 원시 데이터를 저장할 수 있다", "데이터 품질 관리가 항상 최우선이다"],
            correct: 2,
            explanation: "데이터 레이크는 구조화, 반구조화, 비구조화된 모든 형태의 원시 데이터를 저장할 수 있는 저장소입니다. 이러한 특성은 데이터 과학자와 분석가들에게 높은 유연성을 제공하지만, 데이터 거버넌스와 품질 관리 측면에서는 추가적인 노력이 필요합니다. 반면 데이터 웨어하우스는 구조화된 데이터를 저장하고 처리하는 데 최적화되어 있습니다."
          },
          {
            question: "데이터 분석에서 '차원의 저주(Curse of Dimensionality)'란?",
            options: ["데이터 시각화가 3차원 이상 불가능한 현상", "특성(feature)의 수가 증가함에 따라 필요한 데이터의 양이 기하급수적으로 증가하는 현상", "데이터베이스에서 너무 많은 테이블이 생성되는 문제", "클라우드 스토리지 비용이 기하급수적으로 증가하는 현상"],
            correct: 1,
            explanation: "차원의 저주(Curse of Dimensionality)는 특성(feature)의 수가 증가함에 따라 필요한 데이터의 양이 기하급수적으로 증가하는 현상을 말합니다. 고차원 공간에서는 데이터 포인트 간 거리가 의미를 잃고, 데이터가 희소해져 패턴 인식이 어려워집니다. 이를 해결하기 위해 PCA와 같은 차원 축소 기법을 사용합니다."
          },
          {
            question: "ETL과 ELT의 주요 차이점으로 올바른 것은?",
            options: ["ETL은 클라우드 기반, ELT는 온프레미스 기반이다", "ETL은 Extract, Train, Load의 약자다", "ETL은 데이터 변환 후 로드, ELT는 로드 후 변환한다", "ETL은 정형 데이터만, ELT는 비정형 데이터만 처리한다"],
            correct: 2,
            explanation: "ETL(Extract, Transform, Load)은 데이터를 추출하여 변환한 후 타겟 시스템에 로드하는 방식입니다. 반면, ELT(Extract, Load, Transform)는 데이터를 먼저 타겟 시스템에 로드한 후 변환 작업을 수행합니다. ELT는 현대적인 데이터 레이크와 클라우드 기반 시스템에서 더 많이 사용되며, 대규모 데이터셋의 처리에 더 효율적인 경우가 많습니다."
          },
          {
            question: "데이터 시각화에서 '인코딩(Encoding)'이란?",
            options: ["데이터를 암호화하는 보안 기술", "데이터를 압축하는 방법", "데이터를 시각적 요소(색상, 크기, 위치 등)에 매핑하는 과정", "데이터를 다른 형식으로 변환하는 과정"],
            correct: 2,
            explanation: "데이터 시각화에서 '인코딩'은 데이터의 값이나 속성을 시각적 요소(색상, 크기, 모양, 위치 등)에 매핑하는 과정을 말합니다. 예를 들어, 산점도에서 데이터 포인트의 x, y 좌표는 두 변수를 위치에 인코딩한 것이고, 히트맵에서는 값을 색상의 강도로 인코딩합니다. 효과적인 인코딩은 데이터의 패턴과 관계를 직관적으로 파악할 수 있게 합니다."
          },
          {
            question: "A/B 테스트에서 '통계적 유의성(Statistical Significance)'이 의미하는 것은?",
            options: ["테스트의 경제적 가치", "테스트 결과가 중요하다는 주관적 평가", "관찰된 차이가 우연이 아닐 확률이 높다는 것", "테스트에 참여한 사용자 수"],
            correct: 2,
            explanation: "A/B 테스트에서 '통계적 유의성'은 관찰된 두 그룹 간의 차이가 단순한 우연이 아닐 확률이 통계적으로 높다는 것을 의미합니다. 일반적으로 p-값(p-value)이 0.05(5%) 미만일 때 통계적으로 유의하다고 판단합니다. 이는 관찰된 차이가 우연에 의한 것일 확률이 5% 미만이라는 의미입니다. 단, 통계적 유의성이 실질적인 비즈니스 중요성을 항상 보장하지는 않습니다."
          }
        ]
      };
    }
    // 클라우드 관련 퀴즈
    else {
      return {
        quizzes: [
          {
            question: "클라우드 컴퓨팅의 '서비스형 인프라(IaaS)'에 해당하는 것은?",
            options: ["Microsoft Azure Functions", "Amazon EC2", "Google App Engine", "Salesforce"],
            correct: 1,
            explanation: "Amazon EC2(Elastic Compute Cloud)는 대표적인 서비스형 인프라(IaaS) 서비스입니다. IaaS는 가상 머신, 스토리지, 네트워크 등 기본적인 컴퓨팅 인프라를 제공하며, 사용자는 이 위에 운영체제와 애플리케이션을 직접 설치하고 관리합니다. Azure Functions는 서버리스(FaaS), App Engine은 서비스형 플랫폼(PaaS), Salesforce는 서비스형 소프트웨어(SaaS)에 해당합니다."
          },
          {
            question: "다음 중 컨테이너화의 주요 이점이 아닌 것은?",
            options: ["애플리케이션 이식성 향상", "일관된 개발 및 운영 환경 제공", "리소스 사용 효율성", "자동 데이터 백업 및 복구"],
            correct: 3,
            explanation: "컨테이너화는 애플리케이션과 그 의존성을 패키징하여 일관된 환경에서 실행할 수 있게 하는 기술입니다. 주요 이점으로는 이식성 향상, 일관된 환경 제공, 리소스 효율성 등이 있으나, 자동 데이터 백업 및 복구는 컨테이너화 자체의 이점이 아닌 별도의 데이터 관리 솔루션이 필요한 영역입니다. 컨테이너는 일반적으로 상태가 없는(stateless) 애플리케이션에 더 적합합니다."
          },
          {
            question: "마이크로서비스 아키텍처의 특징으로 올바르지 않은 것은?",
            options: ["서비스 간 독립적인 배포 가능", "각 서비스가 특정 비즈니스 기능에 집중", "공유 데이터베이스를 사용하여 데이터 일관성 유지", "서비스별로 다른 기술 스택 사용 가능"],
            correct: 2,
            explanation: "마이크로서비스 아키텍처에서는 일반적으로 각 서비스가 자체 데이터베이스를 관리하며, 공유 데이터베이스를 사용하는 것은 서비스 간 결합도를 높여 마이크로서비스의 독립성과 자율성을 저해합니다. 마이크로서비스의 핵심 원칙 중 하나는 각 서비스가 자신의 데이터를 소유하고, 필요한 경우 API를 통해 데이터에 접근하도록 하는 것입니다."
          },
          {
            question: "클라우드 네이티브 애플리케이션을 설계할 때 고려해야 할 핵심 원칙은?",
            options: ["단일 대형 데이터베이스 사용", "강한 결합(Tight Coupling)을 통한 일관성 확보", "확장성과 복원력을 위한 분산 시스템 설계", "모든 기능을 하나의 서비스에 통합"],
            correct: 2,
            explanation: "클라우드 네이티브 애플리케이션은 확장성, 복원력, 관리 용이성을 위해 분산 시스템으로 설계되어야 합니다. 이는 마이크로서비스, 컨테이너화, 동적 오케스트레이션, 자동화된 CI/CD 등의 원칙을 따릅니다. 단일 대형 데이터베이스와 강한 결합은 확장성을 제한하고, 모든 기능의 통합은 시스템의 복잡성을 증가시키고 유지보수를 어렵게 합니다."
          },
          {
            question: "클라우드 서비스의 '멀티 테넌시(Multi-tenancy)'란?",
            options: ["여러 클라우드 제공업체를 동시에 사용하는 전략", "단일 인스턴스가 여러 고객(테넌트)에게 서비스를 제공하는 구조", "여러 지역에 서비스를 배포하는 방식", "여러 버전의 소프트웨어를 동시에 운영하는 방식"],
            correct: 1,
            explanation: "멀티 테넌시(Multi-tenancy)는 하나의 소프트웨어 인스턴스가 여러 고객(테넌트)에게 서비스를 제공하는 아키텍처입니다. 각 테넌트는 가상적으로 독립된 환경처럼 보이지만, 실제로는 동일한 인프라와 코드 베이스를 공유합니다. 이는 리소스 효율성을 높이고 운영 비용을 절감할 수 있지만, 데이터 격리와 보안에 주의가 필요합니다."
          }
        ]
      };
    }
  }

  async generateQuiz() {
    try {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
      }
      
      // IP 기반 기록 업데이트
      if (this.clientIP && this.completedQuizzes.ipTracking[this.clientIP]) {
        this.completedQuizzes.ipTracking[this.clientIP].lastGenerated = Date.now();
        localStorage.setItem('completedQuizzes', JSON.stringify(this.completedQuizzes));
      }
      
      // 현재 페이지 콘텐츠만 가져오기
      const currentPageContent = this.getCurrentPageContent();
      if (!currentPageContent || currentPageContent.trim().length < 200) {
        throw new Error('현재 페이지에 퀴즈를 생성할 충분한 내용이 없습니다.');
      }
      
      console.log('Current page content length:', currentPageContent.length);
      
      // 콘텐츠 길이에 따라 퀴즈 개수 조정
      const quizCount = this.determineQuizCount(currentPageContent.length);
      console.log(`콘텐츠 길이에 따라 ${quizCount}개의 퀴즈를 생성합니다.`);
      
      let useLocalQuiz = false;
      
      // 현재 페이지 정보
      const currentPost = {
        title: document.title,
        content: currentPageContent,
        url: window.location.href,
        categories: this.getPageCategories()
      };
      
      // API 키가 유효한 경우에만 API 호출 시도
      if (this.apiKey && this.apiKey.length > 10) {
        try {
          // API 호출 시도
          console.log('Sending request to API endpoint:', this.apiEndpoint);
          
          const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `다음 내용을 바탕으로 ${quizCount}개의 퀴즈를 만들어주세요:
${currentPageContent.substring(0, 6000)} // 너무 긴 콘텐츠 잘라내기

반드시 다음 JSON 형식으로만 응답해주세요:
{
  "quizzes": [
    {
      "question": "한글로 된 질문",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 0,
      "explanation": "한글로 된 정답 설명"
    }
  ]
}

퀴즈 생성 가이드라인:
- 반드시 ${quizCount}개의 서로 다른 주제의 퀴즈를 만들어주세요
- 각 퀴즈는 4개의 선택지를 가져야 합니다
- correct는 0-3 사이의 숫자여야 합니다
- 모든 텍스트는 한글로 작성해주세요
- 정답률은 65%가 되도록 난이도를 조절해주세요 (너무 쉽거나 너무 어렵지 않게)
- 지식을 테스트하는 실용적인 질문으로 구성해주세요
- 실무에 적용할 수 있는 내용이 좋습니다
- 오직 제공된 내용에서만 퀴즈를 생성해주세요`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
                topP: 0.8,
                topK: 40
              }
            })
          });

          if (!response.ok) {
            console.warn(`API 오류 (${response.status}), 로컬 퀴즈로 대체합니다.`);
            throw new Error(`API 오류: ${response.status}`);
          }

          const data = await response.json();
          let generatedContent = data.candidates[0].content.parts[0].text;

          // JSON 문자열 정제
          generatedContent = generatedContent
            .replace(/```json\s*|\s*```/g, '')
            .replace(/[\u201C\u201D\u2018\u2019]/g, '"')
            .replace(/\n/g, ' ')
            .trim();

          const parsedQuiz = JSON.parse(generatedContent);
          
          if (!this.validateQuiz(parsedQuiz, quizCount)) {
            throw new Error('잘못된 퀴즈 형식');
          }

          this.quizzes = parsedQuiz.quizzes;
        } catch (apiError) {
          // API 호출 실패 시 로컬 퀴즈 사용
          console.error('API Error:', apiError);
          console.log('Using local quiz instead');
          useLocalQuiz = true;
        }
      } else {
        // API 키가 없거나 유효하지 않은 경우 로컬 퀴즈 사용
        console.log('No valid API key, using local quiz');
        useLocalQuiz = true;
      }
      
      // 로컬 퀴즈 생성 필요한 경우
      if (useLocalQuiz || !this.quizzes || this.quizzes.length === 0) {
        // 로컬 퀴즈 생성
        this.quizzes = this.generateLocalQuizFromContent(currentPageContent, quizCount);
      }
      
      // 퀴즈 인덱스 초기화 및 관련 포스트 정보 추가
      this.currentQuizIndex = 0;
      this.quizzes = this.quizzes.map(quiz => ({
        ...quiz,
        relatedPost: {
          title: currentPost.title,
          url: currentPost.url
        }
      }));

      // 이미 풀었던 퀴즈 필터링
      if (this.clientIP) {
        this.quizzes = this.filterSeenQuizzes(this.quizzes);
      }

      this.currentQuiz = this.quizzes[this.currentQuizIndex];
      this.displayQuiz();
      
    } catch (error) {
      console.error('Quiz generation failed:', error);
      this.showError(`퀴즈 생성 실패: ${error.message}`);
    } finally {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }
  }
  
  // 현재 페이지 내용 가져오기
  getCurrentPageContent() {
    // 1. 주요 콘텐츠 영역 찾기
    const contentElement = document.querySelector('.page__content') || 
                          document.querySelector('article') || 
                          document.querySelector('main');
    
    if (!contentElement) {
      return '';
    }
    
    // 2. 퀴즈 관련 요소들 제외하기 (이미 렌더링된 경우)
    const quizElements = contentElement.querySelectorAll('.quiz-container, #generate-quiz, #error-message, #loading-indicator, .quiz-wrapper');
    quizElements.forEach(el => {
      if (el && el.parentNode) {
        el.style.display = 'none'; // 임시로 숨기기
      }
    });
    
    // 3. 텍스트 콘텐츠 가져오기
    const content = contentElement.textContent || '';
    
    // 4. 퀴즈 요소 다시 표시
    quizElements.forEach(el => {
      if (el) {
        el.style.display = ''; // 원래 상태로 복원
      }
    });
    
    return content;
  }
  
  // 페이지 카테고리 가져오기
  getPageCategories() {
    const categories = [];
    
    // 카테고리 요소 찾기
    const categoryElements = document.querySelectorAll('.page__taxonomy-item[rel="tag"], .page__taxonomy-item[itemprop="keywords"]');
    if (categoryElements && categoryElements.length > 0) {
      categoryElements.forEach(el => {
        if (el.textContent.trim()) {
          categories.push(el.textContent.trim());
        }
      });
    }
    
    return categories;
  }
  
  // 콘텐츠 길이에 따라 퀴즈 개수 결정
  determineQuizCount(contentLength) {
    if (contentLength < 1000) {
      return 2; // 짧은 콘텐츠
    } else if (contentLength < 3000) {
      return 3; // 중간 길이 콘텐츠
    } else if (contentLength < 5000) {
      return 4; // 긴 콘텐츠
    } else {
      return 5; // 매우 긴 콘텐츠
    }
  }
  
  // 페이지 콘텐츠에서 로컬 퀴즈 생성
  generateLocalQuizFromContent(content, count) {
    // 콘텐츠에서 키워드 추출
    const keywords = this.extractContentKeywords(content);
    console.log('Extracted keywords:', keywords);
    
    // 주제 유추
    const topic = this.inferTopicFromKeywords(keywords);
    console.log('Inferred topic:', topic);
    
    // 기본 퀴즈 가져오기
    const baseQuizzes = this.generateLocalQuiz(topic).quizzes;
    
    // 필요한 만큼 선택
    return this.shuffleArray(baseQuizzes).slice(0, Math.min(count, baseQuizzes.length));
  }
  
  // 콘텐츠에서 키워드 추출
  extractContentKeywords(content) {
    // 불용어 필터
    const stopWords = ['무엇', '이것', '것은', '다음', '중에서', '대한', '설명', '올바른', '가장', '어떤', '주요', '의미', '하는',
                      '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과', '이나', '또는'];
    
    // 텍스트 정제
    const cleanText = content.toLowerCase()
      .replace(/[.,?!:;"'()]/g, ' ')
      .replace(/\s+/g, ' ');
    
    // 단어 분리 및 필터링
    const words = cleanText.split(' ')
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // 단어 빈도 계산
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // 빈도순으로 정렬하여 상위 10개 단어 반환
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }
  
  // 키워드로부터 주제 유추
  inferTopicFromKeywords(keywords) {
    // 주제별 관련 키워드
    const topicKeywords = {
      'AI': ['ai', '인공지능', '머신러닝', '딥러닝', '알고리즘', '모델', '학습', '신경망', 'ml'],
      'Data': ['데이터', '분석', '웨어하우스', '레이크', '파이프라인', 'etl', '마이닝', '시각화', '처리'],
      'Cloud': ['클라우드', 'aws', 'azure', 'gcp', '서버', '인프라', '컨테이너', '마이크로서비스', '가상화']
    };
    
    // 각 주제별 점수 계산
    const scores = {};
    
    Object.keys(topicKeywords).forEach(topic => {
      scores[topic] = keywords.reduce((score, keyword) => {
        if (topicKeywords[topic].some(tk => keyword.includes(tk) || tk.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });
    
    // 최고 점수 주제 찾기
    let maxTopic = 'Data'; // 기본값
    let maxScore = 0;
    
    Object.entries(scores).forEach(([topic, score]) => {
      if (score > maxScore) {
        maxTopic = topic;
        maxScore = score;
      }
    });
    
    return maxTopic;
  }

  validateQuiz(quiz, quizCount) {
    try {
      if (!quiz.quizzes || !Array.isArray(quiz.quizzes) || quiz.quizzes.length !== quizCount) {
        console.error(`Quiz must contain exactly ${quizCount} questions`);
        return false;
      }

      return quiz.quizzes.every(q => {
        if (!q.question || typeof q.question !== 'string') {
          console.error('Invalid question format');
          return false;
        }
        
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          console.error('Options must be an array of exactly 4 items');
          return false;
        }
        
        if (q.options.some(option => !option || typeof option !== 'string')) {
          console.error('All options must be non-empty strings');
          return false;
        }
        
        if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
          console.error('Correct answer must be a number between 0 and 3');
          return false;
        }
        
        if (!q.explanation || typeof q.explanation !== 'string') {
          console.error('Invalid explanation format');
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('Quiz validation error:', error);
      return false;
    }
  }

  displayQuiz() {
    const container = document.getElementById('quiz-container');
    if (!container) {
      console.error('Quiz container not found');
      return;
    }

    const totalQuizzes = this.quizzes.length;
    
    container.innerHTML = `
      <div class="quiz-progress">문제 ${this.currentQuizIndex + 1} / ${totalQuizzes}</div>
      <div class="quiz-question"></div>
      <div class="quiz-options"></div>
      <button id="check-answer" class="quiz-button">정답 확인</button>
      <div id="quiz-result" style="display: none;">
        <div class="result-message"></div>
        <div class="explanation"></div>
        <div class="related-posts">
          <h3>관련 포스트</h3>
          <ul></ul>
        </div>
      </div>
      ${this.currentQuizIndex < totalQuizzes - 1 ? 
        '<button id="next-quiz" class="quiz-button" style="margin-top: 1em; display: none;">다음 문제</button>' :
        '<button id="generate-new-quiz" class="quiz-button" style="margin-top: 1em; display: none;">새 퀴즈 생성</button>'
      }
    `;

    const questionDiv = container.querySelector('.quiz-question');
    const optionsDiv = container.querySelector('.quiz-options');

    if (this.currentQuiz && questionDiv && optionsDiv) {
      questionDiv.textContent = this.currentQuiz.question;
      
      optionsDiv.innerHTML = this.currentQuiz.options.map((option, index) => `
        <label>
          <input type="radio" name="quiz" value="${index}">
          ${option}
        </label>
      `).join('');

      container.style.display = 'block';
    }
  }

  checkAnswer() {
    const selected = document.querySelector('input[name="quiz"]:checked');
    if (!selected) {
      alert('답을 선택해주세요');
      return;
    }

    const result = document.getElementById('quiz-result');
    if (!result) return;

    const isCorrect = parseInt(selected.value) === this.currentQuiz.correct;
    
    // 푼 문제 기록
    if (this.currentQuiz && this.currentQuiz.question) {
      this.markQuizAsCompleted(this.currentQuiz.question);
    }
    
    // 추천 포스트 구성
    const suggestedPosts = this.getSuggestedPosts(this.currentQuiz.question, this.currentQuiz.explanation, this.currentQuiz.options);
    const postsHtml = suggestedPosts.length > 0 ? 
      suggestedPosts.map(post => `<li><a href="${post.url}" target="_blank">${post.title}</a></li>`).join('') :
      `<li><a href="${this.currentQuiz.relatedPost.url}" target="_blank">${this.currentQuiz.relatedPost.title}</a></li>`;
    
    // 해설에 마크다운 처리를 위한 임시 해설 변환
    let enhancedExplanation = this.currentQuiz.explanation;
    
    // 해설이 너무 짧으면 확장
    if (enhancedExplanation.length < 100) {
      enhancedExplanation += this.getExtendedExplanation(this.currentQuiz.question, this.currentQuiz.options[this.currentQuiz.correct]);
    }
    
    // 마크다운 스타일 적용 (볼드, 이탤릭, 링크 등)
    enhancedExplanation = enhancedExplanation
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    result.innerHTML = `
      <div class="${isCorrect ? 'notice--success' : 'notice--danger'}">
        <p><strong>${isCorrect ? '정답입니다! 👏' : '틀렸습니다 😢'}</strong></p>
        <p><strong>정답:</strong> ${this.currentQuiz.options[this.currentQuiz.correct]}</p>
        <div class="explanation">
          <h4>📝 자세한 설명</h4>
          <p>${enhancedExplanation}</p>
        </div>
        <div class="related-posts">
          <h4>📚 더 알아보기</h4>
          <p>더 자세한 내용은 다음 글에서 확인하세요:</p>
          <ul>${postsHtml}</ul>
        </div>
      </div>
    `;

    result.style.display = 'block';
    
    // 정답 확인 버튼 숨기기
    const checkAnswerButton = document.getElementById('check-answer');
    if (checkAnswerButton) {
      checkAnswerButton.style.display = 'none';
    }

    // 다음 문제 또는 새 퀴즈 생성 버튼 표시
    const nextButton = document.getElementById('next-quiz');
    const newQuizButton = document.getElementById('generate-new-quiz');
    
    if (nextButton) {
      nextButton.style.display = 'block';
    }
    if (newQuizButton) {
      newQuizButton.style.display = 'block';
    }

    // 라디오 버튼 비활성화
    const radioButtons = document.querySelectorAll('input[name="quiz"]');
    radioButtons.forEach(radio => {
      radio.disabled = true;
    });
  }

  initializeEvents() {
    // 메인 페이지에서는 퀴즈 요소를 표시하지 않음
    if (this.mainPage) {
      return;
    }
    
    // 퀴즈 컨테이너가 없으면 생성
    let quizContainer = document.getElementById('quiz-container');
    if (!quizContainer) {
      console.log('Creating quiz container as it does not exist');
      quizContainer = document.createElement('div');
      quizContainer.id = 'quiz-container';
      quizContainer.style.display = 'none';
      quizContainer.className = 'quiz-container';
      
      // 에러 메시지 요소 추가
      const errorDiv = document.createElement('div');
      errorDiv.id = 'error-message';
      errorDiv.className = 'notice--danger';
      errorDiv.style.cssText = 'padding: 1rem; background-color: #f8d7da; border-left: 5px solid #dc3545; margin: 1rem 0; color: #721c24;';
      
      // 로딩 인디케이터 추가
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'loading-indicator';
      loadingIndicator.className = 'loading-spinner';
      loadingIndicator.innerHTML = '<div class="spinner"></div><p>퀴즈를 생성하는 중입니다...</p>';
      loadingIndicator.style.display = 'none';
      
      // 메인 콘텐츠 영역 찾기 (일반적인 Jekyll 테마의 경우)
      const mainContent = document.querySelector('.page__content') || document.querySelector('main') || document.body;
      
      // CSS 스타일 추가
      const style = document.createElement('style');
      style.textContent = `
        .quiz-container {
          margin: 2rem 0;
          padding: 1.5rem;
          border-radius: 8px;
          background-color: #f8f9fa;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .quiz-question {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        
        .quiz-options label {
          display: block;
          margin: 10px 0;
          padding: 10px;
          background-color: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .quiz-options label:hover {
          background-color: #f0f0f0;
        }
        
        .quiz-button {
          padding: 8px 16px;
          background-color: #0078d4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 1rem;
        }
        
        .quiz-progress {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 1rem;
        }
        
        .notice--success {
          padding: 1rem;
          background-color: #d4edda;
          border-left: 5px solid #28a745;
          margin: 1rem 0;
          color: #155724;
        }
        
        .notice--danger {
          padding: 1rem;
          background-color: #f8d7da;
          border-left: 5px solid #dc3545;
          margin: 1rem 0;
          color: #721c24;
        }
        
        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border-left-color: #0078d4;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      
      // 퀴즈 제목 및 설명 추가
      const quizTitle = document.createElement('h2');
      quizTitle.textContent = '지식 확인 퀴즈';
      
      const quizDescription = document.createElement('p');
      quizDescription.textContent = '이 포스트의 내용을 기반으로 생성된 퀴즈를 풀어보세요.';
      
      // 생성 버튼 추가
      const generateButton = document.createElement('button');
      generateButton.id = 'generate-quiz';
      generateButton.className = 'quiz-button';
      generateButton.textContent = '퀴즈 생성하기';
      
      // 요소들을 컨테이너에 추가
      mainContent.appendChild(quizTitle);
      mainContent.appendChild(quizDescription);
      mainContent.appendChild(generateButton);
      mainContent.appendChild(errorDiv);
      mainContent.appendChild(loadingIndicator);
      mainContent.appendChild(quizContainer);
    }

    // 기존 이벤트 리스너 연결
    const generateButton = document.getElementById('generate-quiz');
    if (generateButton) {
      generateButton.addEventListener('click', () => this.generateQuiz());
    }

    document.addEventListener('click', (e) => {
      if (e.target.id === 'check-answer') {
        this.checkAnswer();
      } else if (e.target.id === 'next-quiz') {
        this.nextQuiz();
      } else if (e.target.id === 'generate-new-quiz') {
        this.generateQuiz();
      }
    });
  }

  showError(message) {
    console.error('Error:', message);
    
    try {
      // 에러 메시지 표시
      let errorDiv = document.getElementById('error-message');
      if (!errorDiv) {
        // 에러 메시지 요소가 없는 경우 생성
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.className = 'notice--danger';
        errorDiv.style.cssText = 'padding: 1rem; background-color: #f8d7da; border-left: 5px solid #dc3545; margin: 1rem 0; color: #721c24;';
        
        // 페이지에 추가
        const container = 
          document.querySelector('.page__content') || 
          document.querySelector('main') || 
          document.querySelector('body');
        
        if (container) {
          container.appendChild(errorDiv);
        } else {
          // 최후의 수단으로 body에 직접 추가
          document.body.appendChild(errorDiv);
        }
      }
      
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      
      // 5초 후 메시지 숨기기
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    } catch (displayError) {
      // 에러 메시지 표시 실패 시 콘솔에만 기록
      console.error('Failed to display error message:', displayError);
    }
  }

  getPostsByCategory() {
    // 선호 태그 목록
    const preferredTags = ['ai', 'data', 'cloud'];
    
    // 선호 태그를 가진 포스트 필터링
    const taggedPosts = this.posts.filter(post => {
      // 태그 검사
      if (post.tags && Array.isArray(post.tags)) {
        const lowerTags = post.tags.map(tag => tag.toLowerCase());
        return preferredTags.some(tag => lowerTags.includes(tag));
      }
      
      // 카테고리 검사 (태그가 없는 경우 카테고리로 대체)
      if (post.categories && Array.isArray(post.categories)) {
        const lowerCategories = post.categories.map(cat => cat.toLowerCase());
        return preferredTags.some(tag => lowerCategories.includes(tag));
      }
      
      return false;
    });
    
    // 선호 태그 포스트가 있으면 반환, 없으면 모든 포스트 반환
    return taggedPosts.length > 0 ? taggedPosts : this.posts;
  }

  nextQuiz() {
    if (this.currentQuizIndex < 4) {
      this.currentQuizIndex++;
      this.currentQuiz = this.quizzes[this.currentQuizIndex];
      this.displayQuiz();
    }
  }

  finishQuiz() {
    this.currentQuizIndex = 0;
    this.generateQuiz();
  }

  // 키워드에 기반하여 관련 포스트 찾기
  getSuggestedPosts(question, explanation, options) {
    if (!this.posts || this.posts.length === 0) {
      return [];
    }

    // 키워드 추출 개선
    const keywordSets = this.extractKeywords(question, explanation, options);
    const primaryKeywords = keywordSets.primary;
    const secondaryKeywords = keywordSets.secondary;
    
    // 점수 기반 관련 포스트 찾기
    const scoredPosts = this.posts.map(post => {
      const title = post.title.toLowerCase();
      const description = post.description ? post.description.toLowerCase() : '';
      const content = post.content ? post.content.toLowerCase() : '';
      const categories = post.categories ? post.categories.join(' ').toLowerCase() : '';
      const tags = post.tags ? post.tags.join(' ').toLowerCase() : '';
      const allText = `${title} ${description} ${content} ${categories} ${tags}`;
      
      let score = 0;
      
      // 제목에 키워드가 있으면 높은 점수
      primaryKeywords.forEach(keyword => {
        if (title.includes(keyword)) score += 10;
        if (allText.includes(keyword)) score += 5;
      });
      
      secondaryKeywords.forEach(keyword => {
        if (title.includes(keyword)) score += 5;
        if (allText.includes(keyword)) score += 2;
      });
      
      // 카테고리 및 태그 매칭
      if (post.categories && post.categories.some(cat => 
        primaryKeywords.some(keyword => cat.toLowerCase().includes(keyword)))) {
        score += 8;
      }
      
      if (post.tags && post.tags.some(tag => 
        primaryKeywords.some(keyword => tag.toLowerCase().includes(keyword)))) {
        score += 8;
      }
      
      return {
        ...post,
        score
      };
    });
    
    // 점수에 따라 정렬하고 상위 3개 반환
    return scoredPosts
      .filter(post => post.score > 0)
      .filter(post => !this.currentQuiz || !this.currentQuiz.relatedPost || post.url !== this.currentQuiz.relatedPost.url)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // 퀴즈 내용에서 키워드 추출
  extractKeywords(question, explanation, options) {
    // 불용어 필터
    const stopWords = ['무엇', '이것', '것은', '다음', '중에서', '대한', '설명', '올바른', '가장', '어떤', '주요', '의미', '하는'];
    
    // 텍스트 준비
    const allText = (question + ' ' + explanation + ' ' + options.join(' ')).toLowerCase();
    const words = allText.split(/\s+/).filter(word => 
      word.length > 1 && 
      !stopWords.includes(word) &&
      !/^[.,?!:;()]$/.test(word)
    );
    
    // 단어 빈도 계산
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // 데이터 관련 핵심 도메인 키워드
    const domainKeywords = [
      '데이터', '웨어하우스', '레이크', '레이크하우스', 'etl', 'elt', '파이프라인', 
      '빅데이터', '분석', '마이닝', '처리', '품질', '거버넌스', '메타데이터', 
      '스키마', '카탈로그', '인프라', '저장소', '스토리지', '클라우드', '인텔리전스',
      '머신러닝', 'ml', 'ai', '인공지능', '비즈니스', '추출', '변환', '적재'
    ];
    
    // 1차 키워드: 도메인 키워드 + 빈도 높은 단어
    const primary = Object.keys(wordFreq)
      .filter(word => 
        domainKeywords.includes(word) || 
        wordFreq[word] > 1
      );
    
    // 2차 키워드: 그 외 관련 단어
    const secondary = Object.keys(wordFreq)
      .filter(word => !primary.includes(word));
    
    return {
      primary,
      secondary
    };
  }
  
  // 해설 확장 함수
  getExtendedExplanation(question, answer) {
    // 질문에 따라 추가 설명 생성
    if (question.includes('데이터 레이크')) {
      return `<br><br>데이터 레이크는 대규모 원시 데이터를 저장하고 처리하기 위한 중앙화된 저장소입니다. 
      데이터 웨어하우스와 달리, 데이터 레이크는 구조화, 반구조화, 비구조화된 데이터를 모두 원시 형태로 저장할 수 있어 
      데이터 과학자와 분석가들에게 데이터 탐색의 유연성을 제공합니다. 
      하지만 이러한 유연성은 데이터 품질 관리의 어려움을 동반하기도 합니다.`;
    } 
    else if (question.includes('ETL')) {
      return `<br><br>ETL(Extract, Transform, Load)은 다양한 소스에서 데이터를 추출하고, 
      필요에 맞게 변환한 후, 데이터 웨어하우스나 다른 대상 시스템에 로드하는 과정입니다. 
      이 프로세스는 데이터 통합 및 분석을 위한 핵심 단계로, 데이터의 품질과 일관성을 확보하는 데 중요한 역할을 합니다.`;
    }
    else if (question.includes('웨어하우스')) {
      return `<br><br>데이터 웨어하우스는 의사 결정을 지원하기 위해 설계된 중앙화된 데이터 저장소입니다. 
      구조화된 데이터를 저장하고, 스키마가 미리 정의되어 있어 일관된 데이터 모델을 제공합니다. 
      주로 비즈니스 인텔리전스, 보고 및 분석에 최적화되어 있으며, 데이터의 품질과 일관성을 보장합니다.`;
    }
    else if (question.includes('레이크하우스')) {
      return `<br><br>데이터 레이크하우스는 데이터 레이크의 저비용 스토리지 및 유연성과 
      데이터 웨어하우스의 관리 기능 및 데이터 구조를 결합한 새로운 데이터 아키텍처입니다. 
      트랜잭션 지원, 스키마 적용, 데이터 거버넌스 등의 기능을 제공하며, 
      빅데이터와 머신러닝 워크로드 모두를 효율적으로 처리할 수 있습니다.`;
    }
    
    // 기본 추가 설명
    return `<br><br>이러한 데이터 관리 및 분석 개념을 이해하는 것은 
    현대 데이터 기반 비즈니스와
    AI 개발 환경에서 매우 중요합니다. 
    적절한 데이터 아키텍처를 선택하면 조직의 데이터 활용 능력을 크게 향상시킬 수 있습니다.`;
  }

  // 이미 본 문제를 필터링
  filterSeenQuizzes(quizzes) {
    if (!this.clientIP || !quizzes || quizzes.length === 0) {
      return quizzes;
    }
    
    // 이미 본 문제 필터링
    const filteredQuizzes = quizzes.filter(quiz => !this.isQuizAlreadySeen(quiz.question));
    
    // 모든 문제를 이미 봤다면 원래 퀴즈 반환
    if (filteredQuizzes.length === 0) {
      console.log('All quizzes already seen, showing some again');
      // 가장 오래된 문제 3개만 선택
      return this.selectLeastRecentQuizzes(quizzes, 3);
    }
    
    return filteredQuizzes;
  }
  
  // 가장 오래 전에 풀었던 문제 선택
  selectLeastRecentQuizzes(quizzes, count) {
    if (!this.clientIP || !quizzes || quizzes.length === 0) {
      return quizzes.slice(0, count);
    }
    
    // 문제별 마지막 풀었던 시간 가져오기
    const questionTimestamps = quizzes.map(quiz => {
      const hash = this.getQuizHash(quiz.question);
      const timestamp = this.completedQuizzes.ipTracking[this.clientIP]?.questions[hash]?.timestamp || 0;
      return { quiz, timestamp };
    });
    
    // 타임스탬프로 정렬하여 가장 오래된 문제 선택
    return questionTimestamps
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, count)
      .map(item => item.quiz);
  }
  
  // 다양한 주제의 추가 퀴즈 생성
  generateAdditionalQuizzes(count) {
    // 주제 목록
    const topics = ['AI', 'Data', 'Cloud'];
    // 모든 주제에서 다양한 문제 수집
    let additionalQuizzes = [];
    topics.forEach(topic => {
      const topicQuizzes = this.generateLocalQuiz(topic).quizzes;
      additionalQuizzes = [...additionalQuizzes, ...topicQuizzes];
    });
    
    // 랜덤하게 섞기
    additionalQuizzes = this.shuffleArray(additionalQuizzes);
    
    // 필요한 수만큼 필터링하고, 이미 본 문제 제외
    return additionalQuizzes
      .filter(quiz => !this.isQuizAlreadySeen(quiz.question))
      .slice(0, count);
  }

  // 배열 랜덤 셔플 함수
  shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  // 제목에서 주제 유추
  getTopicFromTitle(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('ai') || titleLower.includes('인공지능') || 
        titleLower.includes('머신러닝') || titleLower.includes('딥러닝') || titleLower.includes('ml')) {
      return 'AI';
    } 
    else if (titleLower.includes('data') || titleLower.includes('데이터') || 
             titleLower.includes('분석') || titleLower.includes('웨어하우스') || 
             titleLower.includes('레이크') || titleLower.includes('etl')) {
      return 'Data';
    }
    else if (titleLower.includes('cloud') || titleLower.includes('클라우드') || 
             titleLower.includes('aws') || titleLower.includes('azure') || 
             titleLower.includes('gcp') || titleLower.includes('서버')) {
      return 'Cloud';
    }
    
    // 기본값: 랜덤 주제
    const topics = ['AI', 'Data', 'Cloud'];
    return topics[Math.floor(Math.random() * topics.length)];
  }
}

// 페이지 로드 시 QuizGenerator 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 간단한 메인 페이지 확인
  const isMainPage = window.location.pathname === '/' || 
                     window.location.pathname === '/index.html' || 
                     window.location.pathname === '/index';
                     
  if (isMainPage) {
    console.log('메인 페이지: 퀴즈 생성기 초기화를 건너뜁니다.');
    // 필요시 퀴즈 관련 요소를 숨김 처리
    const quizElements = document.querySelectorAll('.quiz-container, #generate-quiz, #error-message, #loading-indicator');
    quizElements.forEach(el => {
      if (el) el.style.display = 'none';
    });
    return;
  }
  
  // 포스트 페이지에서는 정상적으로 초기화
  new QuizGenerator();
});

} // if (typeof window.quizGeneratorInitialized === 'undefined') 문 종료