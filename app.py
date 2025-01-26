import streamlit as st
import google.generativeai as genai
import yaml
import os

def load_api_key():
    # First try to get API key from environment variable
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        return api_key
        
    # Fallback to config file if environment variable is not set
    try:
        with open('_config.yml', 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
            return config.get('gemini_api', {}).get('key')
    except Exception as e:
        st.error(f'Failed to load API key: {e}')
        return None

def initialize_gemini():
    api_key = load_api_key()
    if api_key:
        genai.configure(api_key=api_key)
        return genai.GenerativeModel('gemini-pro')
    return None

def get_chatbot_response(model, prompt, chat_history):
    base_prompt = """당신은 Microsoft Azure 학습 경로 상담 전문가입니다. 
사용자의 배경과 목표를 고려하여 다음 항목들을 포함한 맞춤형 학습 계획을 제시해주세요:
- 추천 학습 경로
- 필요한 선수 지식
- 예상 학습 기간
- 주요 학습 내용
- 추천 자격증
- 실습 프로젝트 제안

답변은 친근하고 전문적인 톤으로 작성해주세요."""

    full_prompt = f"{base_prompt}\n\n이전 대화 내용:\n{chat_history}\n\n현재 질문: {prompt}"
    
    try:
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        return f"죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다: {str(e)}"

def main():
    st.title("Azure 학습 경로 상담 챗봇 💬")
    
    # Initialize session state for chat history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Initialize Gemini model
    model = initialize_gemini()
    if not model:
        st.error("API 키를 불러오는데 실패했습니다.")
        return

    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Chat input
    if prompt := st.chat_input("메시지를 입력하세요..."):
        # Add user message to chat history
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Get chat history as string
        chat_history = "\n".join([f"{'사용자' if msg['role'] == 'user' else '챗봇'}: {msg['content']}" 
                                for msg in st.session_state.messages[:-1]])

        # Get bot response
        with st.chat_message("assistant"):
            with st.spinner("답변을 생성하고 있습니다..."):
                response = get_chatbot_response(model, prompt, chat_history)
                st.markdown(response)
                st.session_state.messages.append({"role": "assistant", "content": response})

if __name__ == "__main__":
    main()