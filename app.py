import os
from dotenv import load_dotenv
import streamlit as st

load_dotenv()

def main():
    st.title("KT AX 학습 도우미")
    
    st.markdown("""
    ## Azure 학습 경로 및 KT 온라인 학습 콘텐츠 안내
    
    이 앱은 Azure 학습 경로와 KT 온라인 학습 콘텐츠를 안내합니다.
    """)
    
    st.header("Microsoft Azure 학습 경로")
    
    st.subheader("추천 학습 리소스")
    st.markdown("""
    - [Azure 기본 사항](https://learn.microsoft.com/ko-kr/training/paths/azure-fundamentals/)
    - [AZ-900 학습 경로](https://learn.microsoft.com/ko-kr/training/paths/az-900-describe-cloud-concepts/)
    - [Azure 관리자](https://learn.microsoft.com/ko-kr/training/paths/az-104-administrator-prerequisites/)
    """)
    
    st.header("KT 학습 포털 지니어스 과정")
    st.markdown("""
    KT 학습 포털 지니어스에서 다음 과정들을 찾아볼 수 있습니다:
    
    1. **Azure 기초 과정** (난이도: 초급)
       - 학습내용: Azure 클라우드 서비스 소개 및 기본 개념
       
    2. **Azure 데이터 관리** (난이도: 중급)
       - 학습내용: Azure 데이터베이스 서비스 및 데이터 관리 방법
    """)

if __name__ == "__main__":
    main()
