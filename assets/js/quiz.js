// 전역 변수로 이미 정의되었는지 확인
if (typeof window.quizGeneratorInitialized === 'undefined') {
  window.quizGeneratorInitialized = true;

class QuizGenerator {
  constructor() {
    try {
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
      
      // 6. 포스트 데이터 로드
      this.loadPosts();
    } catch (error) {
      console.error('QuizGenerator initialization failed:', error);
      this.showError('퀴즈 시스템을 초기화하는데 실패했습니다: ' + error.message);
    }
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
    return {
      quizzes: [
        {
          question: "데이터 레이크의 주요 특징으로 올바른 것은?",
          options: ["구조화된 데이터만 저장 가능하다", "실시간 처리에 최적화되어 있다", "모든 형태의 원시 데이터를 저장할 수 있다", "데이터 품질 관리가 항상 최우선이다"],
          correct: 2,
          explanation: "데이터 레이크는 구조화, 반구조화, 비구조화된 모든 형태의 원시 데이터를 저장할 수 있는 저장소입니다. 이러한 특성은 데이터 과학자와 분석가들에게 높은 유연성을 제공하지만, 데이터 거버넌스와 품질 관리 측면에서는 추가적인 노력이 필요합니다. 반면 데이터 웨어하우스는 구조화된 데이터를 저장하고 처리하는 데 최적화되어 있습니다."
        },
        {
          question: "데이터 웨어하우스에 대한 설명으로 가장 적절한 것은?",
          options: ["비정형 데이터 저장에 최적화되어 있다", "스키마가 미리 정의된 구조화된 데이터를 저장한다", "높은 유연성을 제공하지만 성능이 낮다", "실시간 데이터 분석이 주 목적이다"],
          correct: 1,
          explanation: "데이터 웨어하우스는 스키마가 미리 정의된 구조화된 데이터를 저장하는 시스템입니다. 이는 데이터의 일관성과 품질을 보장하며, 비즈니스 인텔리전스 및 보고 목적으로 최적화되어 있습니다. SQL 기반 쿼리를 통한 빠른 분석이 가능하고, 정형화된 데이터 모델을 제공하여 데이터 분석가와 비즈니스 사용자가 쉽게 사용할 수 있는 장점이 있습니다."
        },
        {
          question: "데이터 레이크하우스의 주요 장점은?",
          options: ["데이터 레이크의 유연성과 웨어하우스의 구조를 결합한다", "오직 비용 효율성만 높다", "구조화된 데이터만 처리할 수 있다", "성능이 데이터 웨어하우스보다 항상 낮다"],
          correct: 0,
          explanation: "데이터 레이크하우스는 데이터 레이크의 유연성과 웨어하우스의 구조화된 특성을 결합한 하이브리드 접근 방식입니다. 이는 저비용 스토리지에 모든 유형의 데이터를 저장하면서도, 데이터 웨어하우스의 트랜잭션 지원, 스키마 적용, 데이터 품질 관리 기능을 제공합니다. 덕분에 BI와 ML 워크로드를 동일한 데이터 플랫폼에서 처리할 수 있어 데이터 복제 및 관리 오버헤드를 줄일 수 있습니다."
        },
        {
          question: "ETL이 의미하는 것은?",
          options: ["Extract, Transform, Load", "Extract, Transfer, Leverage", "Examine, Test, Load", "External Table Link"],
          correct: 0,
          explanation: "ETL은 Extract(추출), Transform(변환), Load(적재)의 약자로, 데이터 통합 과정의 핵심 단계입니다. 다양한 소스에서 데이터를 추출하고, 비즈니스 요구사항에 맞게 데이터를 변환한 후, 타겟 시스템(주로 데이터 웨어하우스)에 로드하는 과정을 의미합니다. 현대적인 데이터 파이프라인에서는 ELT(Extract, Load, Transform) 방식도 많이 사용되는데, 이는 먼저 데이터를 로드한 후 변환하는 접근법입니다."
        },
        {
          question: "다음 중 데이터 레이크가 데이터 웨어하우스와 비교하여 갖는 단점은?",
          options: ["확장성이 낮다", "데이터 처리 속도가 더 빠르다", "데이터 탐색이 더 쉽다", "데이터 품질 관리가 어려울 수 있다"],
          correct: 3,
          explanation: "데이터 레이크는 모든 유형의 데이터를 원시 형태로 저장하기 때문에 데이터 품질 관리가 어려울 수 있습니다. 스키마가 미리 정의되지 않는 'schema-on-read' 접근 방식을 사용하므로, 데이터 거버넌스 및 메타데이터 관리가 더 복잡해집니다. 이는 '데이터 늪(Data Swamp)'이 될 위험성이 있으며, 효과적인 카탈로그 관리와 데이터 관리 정책이 없으면 데이터 찾기와 활용이 어려워질 수 있습니다."
        }
      ]
    };
  }

  async generateQuiz() {
    try {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
      }
      
      let filteredPosts = this.getPostsByCategory();
      if (!filteredPosts || filteredPosts.length === 0) {
        // 카테고리 필터링 없이 모든 포스트 사용
        console.log('No posts with specified category. Using all posts.');
        if (this.posts.length === 0) {
          throw new Error('사용 가능한 포스트가 없습니다.');
        }
        filteredPosts = this.posts;
      }

      const randomPost = filteredPosts[Math.floor(Math.random() * filteredPosts.length)];
      console.log('Selected post:', randomPost.title);
      
      let useLocalQuiz = false;
      
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
                  text: `다음 내용을 바탕으로 5개의 퀴즈를 만들어주세요:
${randomPost.content.substring(0, 6000)} // 너무 긴 콘텐츠 잘라내기

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

주의사항:
- 반드시 5개의 퀴즈를 만들어주세요
- 각 퀴즈는 4개의 선택지를 가져야 합니다
- correct는 0-3 사이의 숫자여야 합니다
- 모든 텍스트는 한글로 작성해주세요
- 정답률은 60%가 되도록 난이도를 조절해주세요`
                }]
              }],
              generationConfig: {
                temperature: 0.3,
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
          
          if (!this.validateQuiz(parsedQuiz)) {
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
        // 포스트 제목에 따라 다른 퀴즈 생성
        const localQuiz = this.generateLocalQuiz(randomPost.title);
        this.quizzes = localQuiz.quizzes;
      }
      
      // 퀴즈 인덱스 초기화 및 관련 포스트 정보 추가
      this.currentQuizIndex = 0;
      this.quizzes = this.quizzes.map(quiz => ({
        ...quiz,
        relatedPost: {
          title: randomPost.title,
          url: randomPost.url
        }
      }));

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

  validateQuiz(quiz) {
    try {
      if (!quiz.quizzes || !Array.isArray(quiz.quizzes) || quiz.quizzes.length !== 5) {
        console.error('Quiz must contain exactly 5 questions');
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

    container.innerHTML = `
      <div class="quiz-progress">문제 ${this.currentQuizIndex + 1} / 5</div>
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
      ${this.currentQuizIndex < 4 ? 
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
    // 테크뉴런 카테고리 포스트 필터링
    const techPosts = this.posts.filter(post => {
      return post.categories && 
             Array.isArray(post.categories) && 
             post.categories.includes('테크뉴런');
    });
    
    // 테크뉴런 카테고리 포스트가 있으면 반환, 없으면 모든 포스트 반환
    return techPosts.length > 0 ? techPosts : this.posts;
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
}

// 페이지 로드 시 QuizGenerator 초기화
document.addEventListener('DOMContentLoaded', () => {
  new QuizGenerator();
});

} // if 문 종료 