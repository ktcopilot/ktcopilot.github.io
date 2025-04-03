// 태그 필터링 기능
document.addEventListener('DOMContentLoaded', function() {
  // 현재 URL이 메인 페이지인지 확인
  if (window.location.pathname !== '/' && !window.location.pathname.endsWith('/index.html')) {
    return; // 메인 페이지가 아니면 실행하지 않음
  }

  // 해시 변경 이벤트 감지
  window.addEventListener('hashchange', filterPostsByTag);
  
  // 초기 로드 시 해시가 있으면 필터링 적용
  filterPostsByTag();
  
  function filterPostsByTag() {
    // URL 해시에서 태그 가져오기 (예: #ai, #cloud 등)
    const tag = window.location.hash.replace('#', '').toLowerCase();
    
    // 태그가 없거나 'all'이면 모든 포스트 표시
    if (!tag || tag === 'all') {
      document.querySelectorAll('.entries-list article, .entries-list .archive__item').forEach(post => {
        post.style.display = '';
      });
      highlightActiveTag('all');
      return;
    }
    
    // 포스트 목록에서 각 포스트를 순회하며 태그 체크
    document.querySelectorAll('.entries-list article, .entries-list .archive__item').forEach(post => {
      // 포스트에서 태그 정보 찾기
      const postTags = post.querySelectorAll('.page__taxonomy-item[rel="tag"]');
      let hasTag = false;
      
      // 포스트의 모든 태그 확인
      postTags.forEach(postTag => {
        const postTagText = postTag.textContent.toLowerCase().trim();
        if (postTagText === tag) {
          hasTag = true;
        }
      });
      
      // 태그 일치 여부에 따라 표시/숨김 처리
      post.style.display = hasTag ? '' : 'none';
    });
    
    // 활성 태그 하이라이트
    highlightActiveTag(tag);
    
    // 필터링된 결과가 없을 때 메시지 표시
    checkEmptyResults(tag);
  }
  
  // 사이드바에서 활성 태그 하이라이트 처리
  function highlightActiveTag(activeTag) {
    // 모든 태그 링크에서 활성 클래스 제거
    document.querySelectorAll('.nav__items li a').forEach(link => {
      link.classList.remove('active');
    });
    
    // 활성 태그에 클래스 추가
    const selector = activeTag === 'all' 
      ? '.nav__items li a[href="/#all"]' 
      : `.nav__items li a[href="/#${activeTag}"]`;
    
    const activeLink = document.querySelector(selector);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
  
  // 필터링된 결과가 없을 때 메시지 표시
  function checkEmptyResults(tag) {
    // 이미 있는 메시지 제거
    const existingMessage = document.getElementById('empty-results-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // 화면에 표시된 포스트 개수 확인
    const visiblePosts = document.querySelectorAll('.entries-list article:not([style*="display: none"]), .entries-list .archive__item:not([style*="display: none"])');
    
    if (visiblePosts.length === 0) {
      // 결과가 없으면 메시지 표시
      const entriesList = document.querySelector('.entries-list');
      if (entriesList) {
        const message = document.createElement('div');
        message.id = 'empty-results-message';
        message.className = 'notice notice--info';
        message.innerHTML = `<p>"${tag}" 태그가 있는 포스트가 없습니다.</p>`;
        entriesList.appendChild(message);
      }
    }
  }
  
  // 디버그 정보 출력 (개발용)
  console.log('Tag filter initialized');
  const posts = document.querySelectorAll('.entries-list article, .entries-list .archive__item');
  console.log(`Found ${posts.length} posts`);
}); 