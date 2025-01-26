import os
from dotenv import load_dotenv
import streamlit as st
import google.generativeai as genai

load_dotenv()

# Gemini API 설정
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    # config.yml에서 키 가져오기 시도
    try:
        import yaml
        with open('_config.yml', 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
            GOOGLE_API_KEY = config.get('gemini_api', {}).get('key')
    except Exception as e:
        st.error(f"API 키를 불러오는데 실패했습니다: {e}")
        st.stop()

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    st.error("GOOGLE_API_KEY가 설정되지 않았습니다.")
    st.stop()

BASE_PROMPT = """당신은 Microsoft Azure 및 KT 온라인 학습 경로 상담 전문가입니다. 
사용자의 질문에 따라 간단명료하게 답변해주세요.

답변 시 다음 네 가지 출처를 활용하여 답변하세요:

1. Azure 학습 경로 내용
2. KT 온라인 콘텐츠 목록
- KT 교육과정 추천 시 반드시 "KT 학습 포털 지니어스에서 찾을 수 있는 과정으로 추천해드리면," 이라고 말한 후 시작하세요
- 추천 형식: "[과정명] (난이도: 초급/중급/고급)
  - 학습내용: {과정 내용}"

3. Microsoft Learn의 다음 페이지들:
- Azure 기본 사항: https://learn.microsoft.com/ko-kr/training/paths/azure-fundamentals/
- AZ-900 학습 경로: https://learn.microsoft.com/ko-kr/training/paths/az-900-describe-cloud-concepts/
- Azure 관리자: https://learn.microsoft.com/ko-kr/training/paths/az-104-administrator-prerequisites/

4. KT Copilot 사이트의 실제 존재하는 포스트

답변은 친근하고 전문적인 톤으로, 그리고 꼭 필요한 내용만 간단히 작성해주세요."""

def get_chatbot_response(model, prompt, chat_history):
    """챗봇 응답 생성"""
    try:
        full_prompt = f"{BASE_PROMPT}\n\n이전 대화 내용:\n{chat_history}\n\n현재 질문: {prompt}"
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        st.error(f"API Error: {str(e)}")
        if hasattr(e, 'response'):
            st.error(f"Response Status: {e.response.status_code}")
            st.error(f"Response Body: {e.response.text}")
        return "죄송합니다. API 호출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

def main():
    st.title("KT AX 학습 도우미 💬")
    
    # API 키 상태 표시
    if GOOGLE_API_KEY:
        st.sidebar.success("API 키가 설정되었습니다.")
        masked_key = f"{GOOGLE_API_KEY[:4]}...{GOOGLE_API_KEY[-4:]}"
        st.sidebar.text(f"API Key: {masked_key}")
    
    # 세션 상태 초기화
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {"role": "assistant", "content": "안녕하세요! KT AX 학습 도우미입니다. 어떤 도움이 필요하신가요?"}
        ]

    # Gemini 모델 초기화
    model = genai.GenerativeModel('gemini-pro')
    
    # 채팅 히스토리 표시
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # 사용자 입력
    if prompt := st.chat_input("메시지를 입력하세요..."):
        # 사용자 메시지 추가
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # 채팅 히스토리 생성
        chat_history = "\n".join([
            f"{'사용자' if msg['role'] == 'user' else '챗봇'}: {msg['content']}" 
            for msg in st.session_state.messages[:-1]
        ])

        # 챗봇 응답
        with st.chat_message("assistant"):
            with st.spinner("답변을 생성하고 있습니다..."):
                response = get_chatbot_response(model, prompt, chat_history)
                st.markdown(response)
                st.session_state.messages.append({"role": "assistant", "content": response})

if __name__ == "__main__":
    main()
