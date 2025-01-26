class ChatBot {
    constructor() {
      this.GEMINI_API_KEY = null;
      this.BASE_PROMPT = `당신은 Microsoft Azure 및 KT 온라인 학습 경로 상담 전문가입니다. 
사용자의 질문에 따라 간단명료하게 답변해주세요.

첫 인사는 다음과 같이 해주세요:
"안녕하세요! KT AX 학습 도우미입니다. 어떤 도움이 필요하신가요?"

답변 시 다음 네 가지 출처를 활용하여 답변하세요:

1. @2025-01-19-01.md 문서의 Azure 학습 경로 내용

2. @2025-01-19-02.md 문서의 KT 온라인 콘텐츠 목록
- @2025-01-19-02.md 문서에 있는 과정만 추천하세요. 목록에 없는 과정은 절대 추천하지 마세요
- KT 교육과정 추천 시 반드시 "KT 학습 포털 지니어스에서 찾을 수 있는 과정으로 추천해드리면," 이라고 말한 후 시작하세요
- 추천 형식: "[과정명] (난이도: 초급/중급/고급)
  - 학습내용: {문서에 있는 그대로의 학습내용}"

3. Microsoft Learn의 다음 페이지들:
- Azure 기본 사항: https://learn.microsoft.com/ko-kr/training/paths/azure-fundamentals/
- AZ-900 학습 경로: https://learn.microsoft.com/ko-kr/training/paths/az-900-describe-cloud-concepts/
- Azure 관리자: https://learn.microsoft.com/ko-kr/training/paths/az-104-administrator-prerequisites/

4. KT Copilot 사이트의 실제 존재하는 포스트

답변은 친근하고 전문적인 톤으로, 그리고 꼭 필요한 내용만 간단히 작성해주세요.
접속되지 않거나 찾을 수 없는 페이지는 절대 알려주지 마세요.
증거 없는 내용을 알려주지 마세요.`;

      
      this.chatHistory = [];
      this.createElements();
      this.initializeStyles();
      this.attachEventListeners();
      this.initializeGeminiAPI();
    }
  
    async initializeGeminiAPI() {
      try {
        const apiKeyMeta = document.querySelector('meta[name="gemini-api-key"]');
        if (apiKeyMeta) {
          this.GEMINI_API_KEY = apiKeyMeta.content;
        } else {
          // config.yml에서 API 키 가져오기 시도
          const response = await fetch('/_config.yml');
          const config = await response.text();
          const match = config.match(/key: "([^"]+)"/);
          if (match) {
            this.GEMINI_API_KEY = match[1];
          }
        }

        if (!this.GEMINI_API_KEY) {
          throw new Error('Gemini API key not found');
        }
      } catch (error) {
        console.error('Failed to initialize Gemini API:', error);
        this.addMessage('API 키 초기화에 실패했습니다. 관리자에게 문의해주세요.', false);
      }
    }
  
    async getGeminiResponse(prompt) {
      if (!this.GEMINI_API_KEY) {
        console.error('API key is not set');
        return '죄송합니다. API 키가 설정되지 않았습니다.';
      }

      try {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + this.GEMINI_API_KEY,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
          }
        );

        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid response format');
        }
        
        return data.candidates[0].content.parts[0].text;
      } catch (error) {
        console.error('Error getting Gemini response:', error);
        return '죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다. 다시 시도해주세요.';
      }
    }
  
    createElements() {
      // 채팅 컨테이너 생성
      this.container = document.createElement('div');
      this.container.className = 'chat-container';
      
      // 채팅 버튼 생성
      this.chatButton = document.createElement('button');
      this.chatButton.className = 'chat-button';
      this.chatButton.innerHTML = '💬 상담하기';
      
      // 채팅 창 생성
      this.chatWindow = document.createElement('div');
      this.chatWindow.className = 'chat-window';
      
      // 채팅 메시지 영역
      this.messagesContainer = document.createElement('div');
      this.messagesContainer.className = 'chat-messages';
      
      // 입력 영역
      this.inputContainer = document.createElement('div');
      this.inputContainer.className = 'chat-input-container';
      
      this.input = document.createElement('input');
      this.input.type = 'text';
      this.input.placeholder = '메시지를 입력하세요...';
      
      this.sendButton = document.createElement('button');
      this.sendButton.innerHTML = '전송';
      
      // DOM에 요소 추가
      this.inputContainer.appendChild(this.input);
      this.inputContainer.appendChild(this.sendButton);
      this.chatWindow.appendChild(this.messagesContainer);
      this.chatWindow.appendChild(this.inputContainer);
      this.container.appendChild(this.chatWindow);
      this.container.appendChild(this.chatButton);
      document.body.appendChild(this.container);
    }
  
    initializeStyles() {
      const styles = `
        .chat-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .chat-button {
          padding: 12px 24px;
          background-color: #0078d4;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        
        .chat-window {
          display: none;
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 400px;
          height: 600px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          flex-direction: column;
          overflow: hidden;
        }
        
        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          max-height: calc(100% - 60px);
        }
        
        .chat-input-container {
          display: flex;
          padding: 15px;
          border-top: 1px solid #eee;
          background: #f8f9fa;
        }
        
        .chat-input-container input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          margin-right: 8px;
          font-size: 14px;
        }
        
        .chat-input-container button {
          padding: 8px 16px;
          background-color: #0078d4;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .message {
          margin-bottom: 16px;
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 85%;
          line-height: 1.5;
          white-space: pre-line;
          font-size: 14px;
        }
        
        .user-message {
          background-color: #e3f2fd;
          margin-left: auto;
          color: #0d47a1;
        }
        
        .bot-message {
          background-color: #f5f5f5;
          color: #333;
        }
        
        .bot-message p {
          margin: 8px 0;
        }
        
        .bot-message ul, .bot-message ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .bot-message li {
          margin: 4px 0;
        }
      `;
      
      // 기존 스타일은 유지하면서 메시지 관련 스타일만 수정
      const existingStyles = document.querySelector('style');
      if (existingStyles) {
        existingStyles.textContent += styles;
      } else {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
      }
    }
  
    attachEventListeners() {
      this.chatButton.onclick = () => this.toggleChat();
      this.sendButton.onclick = () => this.sendMessage();
      this.input.onkeypress = (e) => {
        if (e.key === 'Enter') this.sendMessage();
      };
    }
  
    toggleChat() {
      const isVisible = this.chatWindow.style.display === 'flex';
      this.chatWindow.style.display = isVisible ? 'none' : 'flex';
      
      // 채팅창이 열릴 때 인사 메시지 표시
      if (!isVisible) {
        this.addMessage('안녕하세요! Azure 학습 상담사입니다. 어떤 도움이 필요하신가요?', false);
      }
    }
  
    addMessage(message, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
      
      if (isUser) {
        messageDiv.textContent = message;
      } else {
        // HTML 태그를 허용하여 렌더링
        messageDiv.innerHTML = message;
        
        // 링크에 대한 스타일과 동작 추가
        const links = messageDiv.getElementsByTagName('a');
        Array.from(links).forEach(link => {
          link.style.color = '#0066cc';
          link.style.textDecoration = 'underline';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        });
      }
      
      this.messagesContainer.appendChild(messageDiv);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      return messageDiv;
    }
  
    async sendMessage() {
      const message = this.input.value.trim();
      if (!message) return;
      
      // 사용자 메시지 추가
      const userMessage = this.addMessage(message, true);
      this.input.value = '';
      
      // 채팅 히스토리에 추가
      this.chatHistory.push(message);
      
      // Gemini API 호출을 위한 프롬프트 구성
      const fullPrompt = `${this.BASE_PROMPT}\n\n이전 대화 내용:\n${this.chatHistory.join('\n')}\n\n현재 질문: ${message}`;
      
      // 로딩 메시지 표시
      const loadingMessage = this.addMessage('답변을 생성하고 있습니다...', false);
      
      // Gemini API 호출
      const response = await this.getGeminiResponse(fullPrompt);
      
      // 로딩 메시지 제거
      loadingMessage.remove();
      
      // 봇 응답 추가
      this.addMessage(response, false);
    }
  }
  
  // 페이지 로드 시 챗봇 초기화
  document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
  });