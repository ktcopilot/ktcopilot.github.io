class ChatBot {
  constructor() {
    this.GEMINI_API_KEY = null;
    this.BASE_PROMPT = `당신은 Microsoft Azure 학습 경로 상담 전문가입니다. 
사용자의 배경과 목표를 고려하여 다음 항목들을 포함한 맞춤형 학습 계획을 제시해주세요:
- 추천 학습 경로
- 필요한 선수 지식
- 예상 학습 기간
- 주요 학습 내용
- 추천 자격증
- 실습 프로젝트 제안

답변은 친근하고 전문적인 톤으로 작성해주세요.`;
    
    this.chatHistory = [];
    this.createElements();
    this.initializeStyles();
    this.attachEventListeners();
    this.loadApiKey();
  }

  async loadApiKey() {
    try {
      const response = await fetch('/_config.yml');
      const config = await response.text();
      const match = config.match(/key: "([^"]+)"/);
      if (match) {
        this.GEMINI_API_KEY = match[1];
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }

  async getGeminiResponse(prompt) {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.GEMINI_API_KEY}`
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

      const data = await response.json();
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
    this.chatButton.innerHTML = '💬 Azure 학습 상담';
    
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

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;
    
    // 사용자 메시지 추가
    this.addMessage(message, true);
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

  // ... (이전에 작성한 나머지 메서드들: initializeStyles, attachEventListeners, toggleChat, addMessage)
}

// 페이지 로드 시 챗봇 초기화
document.addEventListener('DOMContentLoaded', () => {
  new ChatBot();
});