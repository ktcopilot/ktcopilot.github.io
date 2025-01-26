import streamlit as st
import google.generativeai as genai
import os
from datetime import datetime

# Gemini API 키 설정
try:
    GOOGLE_API_KEY = st.secrets["GOOGLE_API_KEY"]
except Exception:
    # 로컬 개발 환경을 위한 폴백
    from dotenv import load_dotenv
    load_dotenv()
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    st.error("Please set GOOGLE_API_KEY in .streamlit/secrets.toml or .env file")
    st.stop()

# 기본 프롬프트 템플릿
BASE_PROMPT = """
당신은 Microsoft Azure 학습 경로 상담 전문가입니다. 
다음 정보를 바탕으로 사용자에게 최적화된 Azure 학습 경로를 추천해주세요:

1. 기본 참고 문서: _posts/2025-01-19-01.md의 내용
2. 추가 참고: Microsoft Learn (https://learn.microsoft.com/ko-kr/training/)

사용자의 배경과 목표를 고려하여 다음 항목들을 포함한 맞춤형 학습 계획을 제시해주세요:
- 추천 학습 경로
- 필요한 선수 지식
- 예상 학습 기간
- 주요 학습 내용
- 추천 자격증
- 실습 프로젝트 제안

답변은 친근하고 전문적인 톤으로 작성해주세요.
"""

def initialize_session_state():
    if 'chat_history' not in st.session_state:
        st.session_state.chat_history = []
    if 'user_info' not in st.session_state:
        st.session_state.user_info = None

def get_gemini_response(prompt, chat_history):
    try:
        model = genai.GenerativeModel('gemini-pro')
        # 채팅 히스토리를 문자열로 변환
        chat_context = "\n".join(chat_history) if chat_history else ""
        full_prompt = f"{prompt}\n\n이전 대화 내용:\n{chat_context}" if chat_context else prompt
        
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        st.error(f"Error generating response: {str(e)}")
        return "죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다. 다시 시도해주세요."

def main():
    st.set_page_config(
        page_title="Azure 학습 경로 상담 챗봇",
        page_icon="🎓",
        layout="wide"
    )
    
    st.title("🎓 Azure 학습 경로 상담 챗봇")
    initialize_session_state()
    
    # 사이드바에 사용자 정보 입력
    with st.sidebar:
        st.subheader("👤 사용자 정보")
        if st.session_state.user_info is None:
            with st.form("user_info_form"):
                background = st.selectbox(
                    "전공/배경",
                    ["IT/컴퓨터공학", "비전공자", "타 이공계열", "기타"]
                )
                experience = st.selectbox(
                    "IT 경력",
                    ["신입/없음", "1-3년", "3-5년", "5년 이상"]
                )
                current_role = st.selectbox(
                    "현재/희망 직무",
                    ["개발자", "인프라 엔지니어", "데이터 엔지니어", "클라우드 아키텍트", "DevOps 엔지니어", "기타"]
                )
                learning_goal = st.text_area("학습 목표")
                
                submit = st.form_submit_button("상담 시작")
                if submit:
                    st.session_state.user_info = {
                        "background": background,
                        "experience": experience,
                        "current_role": current_role,
                        "learning_goal": learning_goal
                    }
                    # 초기 상담 메시지 생성
                    initial_prompt = f"{BASE_PROMPT}\n\n사용자 정보:\n"
                    initial_prompt += f"- 배경: {background}\n"
                    initial_prompt += f"- IT 경력: {experience}\n"
                    initial_prompt += f"- 직무: {current_role}\n"
                    initial_prompt += f"- 학습 목표: {learning_goal}\n"
                    
                    response = get_gemini_response(initial_prompt, [])
                    st.session_state.chat_history.append(("assistant", response))
                    st.rerun()

    # 메인 채팅 인터페이스
    if st.session_state.user_info is not None:
        chat_container = st.container()
        with chat_container:
            for role, message in st.session_state.chat_history:
                if role == "user":
                    st.write("👤 You:", message)
                else:
                    st.write("🤖 Advisor:", message)
        
        # 입력 필드를 항상 화면 하단에 고정
        with st.container():
            user_input = st.text_input("추가 질문이 있으시다면 입력해주세요:", key="user_input")
            if user_input:
                st.session_state.chat_history.append(("user", user_input))
                response = get_gemini_response(user_input, [msg for _, msg in st.session_state.chat_history])
                st.session_state.chat_history.append(("assistant", response))
                st.rerun()

if __name__ == "__main__":
    main() 