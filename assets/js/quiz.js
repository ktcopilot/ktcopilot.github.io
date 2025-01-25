class QuizGenerator {
  constructor() {
    try {
      this.apiKey = document.querySelector('meta[name="gemini-api-key"]').content;
      if (!this.apiKey) {
        throw new Error('Gemini API key not found');
      }
      this.apiEndpoint = document.querySelector('meta[name="gemini-api-endpoint"]').content;
      this.posts = [];
      this.currentQuiz = null;
      this.currentQuizIndex = 0;
      this.quizzes = [];
      
      this.initializeEvents();
      this.loadPosts();
    } catch (error) {
      console.error('QuizGenerator initialization failed:', error);
      this.showError('퀴즈 시스템을 초기화하는데 실패했습니다.');
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

  async generateQuiz() {
    try {
      const loadingIndicator = document.getElementById('loading-indicator');
      loadingIndicator.style.display = 'block';
      
      const filteredPosts = this.getPostsByCategory();
      if (!filteredPosts || filteredPosts.length === 0) {
        throw new Error('사용 가능한 포스트가 없습니다.');
      }

      const randomPost = filteredPosts[Math.floor(Math.random() * filteredPosts.length)];
      const prompt = `다음 내용을 바탕으로 5개의 퀴즈를 만들어주세요:
${randomPost.content}

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
- 모든 텍스트는 한글로 작성해주세요`;

      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
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

      try {
        const parsedQuiz = JSON.parse(generatedContent);
        
        if (!this.validateQuiz(parsedQuiz)) {
          throw new Error('잘못된 퀴즈 형식');
        }

        this.quizzes = parsedQuiz.quizzes;
        this.currentQuizIndex = 0;
        
        // 모든 퀴즈에 relatedPost 정보 추가
        this.quizzes = this.quizzes.map(quiz => ({
          ...quiz,
          relatedPost: {
            title: randomPost.title,
            url: randomPost.url
          }
        }));

        this.currentQuiz = this.quizzes[this.currentQuizIndex];
        this.displayQuiz();
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Failed content:', generatedContent);
        throw new Error('퀴즈 형식이 올바르지 않습니다');
      }
    } catch (error) {
      console.error('Quiz generation failed:', error);
      this.showError(`퀴즈 생성 실패: ${error.message}`);
    } finally {
      const loadingIndicator = document.getElementById('loading-indicator');
      loadingIndicator.style.display = 'none';
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
    
    result.innerHTML = `
      <div class="${isCorrect ? 'notice--success' : 'notice--danger'}">
        <p><strong>${isCorrect ? '정답입니다! 👏' : '틀렸습니다 😢'}</strong></p>
        <p>정답: ${this.currentQuiz.options[this.currentQuiz.correct]}</p>
        <p>설명: ${this.currentQuiz.explanation}</p>
        <div class="related-posts">
          <h3>관련 포스트</h3>
          <p><a href="${this.currentQuiz.relatedPost.url}" target="_blank">${this.currentQuiz.relatedPost.title}</a></p>
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
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }

  getPostsByCategory() {
    return this.posts.filter(post => {
      return post.categories && 
             Array.isArray(post.categories) && 
             post.categories.includes('테크뉴런');
    });
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
}

document.addEventListener('DOMContentLoaded', () => {
  new QuizGenerator();
}); 