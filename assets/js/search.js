// 검색 기능 초기화
$(document).ready(function() {
  console.log("검색 스크립트 로드됨");
  
  // 전역 변수
  var resultdiv = $('#results');
  
  // 검색 데이터 확인 및 인덱스 생성
  if (typeof window.searchData !== 'object' || !window.searchData.store || window.searchData.store.length === 0) {
    console.error("검색 데이터가 없습니다");
    resultdiv.html('<p class="search-error">검색 데이터를 불러올 수 없습니다. 페이지를 새로고침 해보세요.</p>');
    return;
  }
  
  console.log("검색 데이터 항목 수: " + window.searchData.store.length);
  
  // lunr.js가 로드되었는지 확인
  if (typeof lunr !== 'function') {
    console.error("lunr.js가 로드되지 않았습니다");
    resultdiv.html('<p class="search-error">검색 엔진을 불러올 수 없습니다. 페이지를 새로고침 해보세요.</p>');
    return;
  }
  
  // 검색 데이터 전처리
  try {
    // 데이터 객체 정제
    var cleanedData = [];
    
    for (var i = 0; i < window.searchData.store.length; i++) {
      var item = window.searchData.store[i];
      
      // 데이터 유효성 확인
      if (!item) continue;
      
      // 정제된 아이템 생성
      var cleanItem = {
        id: i,
        title: typeof item.title === 'string' ? item.title : "",
        excerpt: typeof item.excerpt === 'string' ? item.excerpt : "",
        url: item.url || "#"
      };
      
      // 카테고리 처리
      if (Array.isArray(item.categories)) {
        cleanItem.categories = item.categories.join(" ");
      } else if (item.categories) {
        cleanItem.categories = String(item.categories);
      } else {
        cleanItem.categories = "";
      }
      
      // 태그 처리
      if (Array.isArray(item.tags)) {
        cleanItem.tags = item.tags.join(" ");
        cleanItem.tagList = item.tags; // 원본 배열 보존
      } else if (item.tags) {
        cleanItem.tags = String(item.tags);
        cleanItem.tagList = [];
      } else {
        cleanItem.tags = "";
        cleanItem.tagList = [];
      }
      
      // 티저 이미지
      if (item.teaser) {
        cleanItem.teaser = item.teaser;
      }
      
      // 정제된 데이터 저장
      cleanedData.push(cleanItem);
    }
    
    // 전역 데이터 교체
    window.searchData.store = cleanedData;
    
    console.log("검색 데이터 전처리 완료");
  } catch (err) {
    console.error("데이터 전처리 오류:", err);
  }
  
  // 즉시 인덱스 생성
  try {
    console.log("lunr 인덱스 생성 시작");
    
    // 에러 방지를 위해 lunr 옵션 확인
    var lunrVersion = lunr.version || "unknown";
    console.log("Lunr 버전:", lunrVersion);
    
    window.searchData.idx = lunr(function() {
      // 검색 필드 정의
      this.field('title', { boost: 10 });
      this.field('excerpt');
      this.field('categories');
      this.field('tags');
      this.ref('id');
      
      // 영어 설정 (런타임 에러 방지)
      try {
        if (typeof lunr.en === 'function') {
          lunr.en.call(this);
        }
      } catch (err) {
        console.warn("lunr.en 함수 호출 중 오류:", err);
      }
      
      // 한글 분석기(토크나이저) 추가
      this.use(function(builder) {
        // 간단한 한글 토크나이저 - 문자 단위 분리
        var koreanAnalyzer = function(str) {
          if (!str) return [];
          
          // 문자열 변환 확인
          var text = String(str).toLowerCase();
          if (!text) return [];
          
          // 모든 공백 단위로 우선 나누기
          var tokens = text.split(/[\s\-]+/);
          var result = [];
          
          // 각 토큰 처리
          tokens.forEach(function(token) {
            // 빈 토큰 스킵
            if (!token) return;
            
            // 한글 포함 여부 확인
            var hasKorean = /[가-힣]/.test(token);
            
            if (hasKorean && token.length > 1) {
              // 한글 단어를 개별 글자로 분리 - 자소 검색 지원
              for (var i = 0; i < token.length; i++) {
                result.push(token.slice(i));
                
                // 2글자 이상 조합도 추가
                for (var j = 2; j <= 3 && i + j <= token.length; j++) {
                  result.push(token.slice(i, i + j));
                }
              }
              // 전체 단어도 추가
              result.push(token);
            } else {
              // 비한글은 그대로 추가
              result.push(token);
            }
          });
          
          return result;
        };
        
        // 한글 토크나이저 등록
        builder.tokenizer = koreanAnalyzer;
      });
      
      // 문서 추가
      for (var i = 0; i < window.searchData.store.length; i++) {
        try {
          var item = window.searchData.store[i];
          if (!item) continue;
          
          console.log("문서 추가 시도 #" + i + ": " + (item.title || "제목 없음"));
          
          // 항목 복사하여 필드 관리 - 안전하게 문자열 처리
          var doc = { id: i };
          
          // 모든 필드에 안전한 문자열 처리 적용
          ['title', 'excerpt', 'categories', 'tags'].forEach(function(field) {
            // 필드 값 확인 및 안전하게 처리
            var value = item[field];
            
            // 빈 문자열로 기본값 설정
            if (!value || value === null || value === undefined) {
              doc[field] = "";
              return;
            }
            
            // 문자열 변환 및 트림
            if (typeof value === 'string') {
              doc[field] = value.trim();
            } else if (typeof value === 'number') {
              doc[field] = String(value);
            } else if (typeof value === 'boolean') {
              doc[field] = String(value);
            } else if (Array.isArray(value)) {
              doc[field] = value.join(" ").trim();
            } else if (typeof value === 'object') {
              try {
                doc[field] = JSON.stringify(value);
              } catch (e) {
                doc[field] = "";
              }
            } else {
              // 기타 타입은 빈 문자열로
              doc[field] = "";
            }
          });
          
          // 이 문서를 인덱스에 안전하게 추가
          this.add(doc);
        } catch (err) {
          console.warn("문서 추가 중 오류:", err, "문서:", item ? (item.title || "제목 없음") : "알 수 없음");
          // 오류 발생해도 계속 진행
          continue;
        }
      }
    });
    console.log("lunr 인덱스 생성 완료");
    
    // 초기 메시지 표시
    resultdiv.html('<div class="search-initial-message"><p>검색어를 입력하면 결과가 여기에 표시됩니다.</p></div>');
    
    // URL 검색 처리
    processUrlSearchQuery();
  } catch (e) {
    console.error("인덱스 생성 오류:", e);
    resultdiv.html('<p class="search-error">검색 인덱스 생성 중 오류가 발생했습니다: ' + e.message + '</p>');
    return;
  }
  
  // 타이핑 지연 처리를 위한 변수
  var searchTimeout = null;
  
  // 검색 이벤트 연결 (타이핑 지연 적용)
  $('input#search').on('keyup', function() {
    var query = $(this).val().toLowerCase().trim();
    
    // 기존 타이머 취소
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // 빈 쿼리 처리
    if (query === '') {
      resultdiv.html('<div class="search-initial-message"><p>검색어를 입력하면 결과가 여기에 표시됩니다.</p></div>');
      return;
    }
    
    // 타이핑 지연 후 검색 실행
    searchTimeout = setTimeout(function() {
      performSearch(query);
    }, 300); // 300ms 지연
  });
  
  // 실제 검색 수행 함수
  function performSearch(query) {
    // 선택된 검색 옵션 가져오기
    var searchOption = $('input[name="search-option"]:checked').val() || 'all';
    resultdiv.html('<div class="searching"><div class="loader"></div><p>검색 중...</p></div>');
    
    // 검색 수행
    try {
      var results;
      
      if (searchOption === 'title') {
        results = window.searchData.idx.search('title:' + query + '^10');
      } else if (searchOption === 'content') {
        results = window.searchData.idx.search('excerpt:' + query);
      } else {
        // 기본 검색 - 더 유연한 검색 구현
        results = window.searchData.idx.query(function(q) {
          // 정확한 용어에 높은 가중치 부여
          q.term(query, { boost: 100 });
          
          // 단어 단위로 분리하여 검색 - 한글 자소 검색 강화
          query.split(/\s+/).forEach(function(term) {
            if (term.length > 0) {
              // 접두사 매칭 (시작하는 단어)
              q.term(term + '*', { boost: 10 });
              
              // 필드별 검색
              q.term('title:' + term, { boost: 5 });
              q.term('excerpt:' + term, { boost: 3 });
              q.term('tags:' + term, { boost: 2 });
              
              // 퍼지 매칭 (오타 허용)
              if (term.length > 2) {
                q.term(term, { editDistance: 1, boost: 1 });
              }
              
              // 한글 처리 - 자소 분리 등의 검색 강화
              if (/[가-힣]/.test(term) && term.length > 1) {
                // 각 글자별 검색
                for (var i = 0; i < term.length; i++) {
                  q.term(term[i], { boost: 3 });
                }
                
                // 부분 문자열 검색
                for (var i = 0; i < term.length - 1; i++) {
                  var substr = term.substr(i, 2);
                  q.term(substr, { boost: 2 });
                }
              }
            }
          });
        });
      }
      
      resultdiv.empty();
      
      // 결과 개수 표시
      resultdiv.prepend('<p class="results__found">' + results.length + ' 개의 검색 결과</p>');
      
      // 결과 없음 처리
      if (results.length === 0) {
        resultdiv.append('<p class="no-results">검색 결과가 없습니다. 다른 검색어를 시도해보세요.</p>');
        return;
      }
      
      // 결과 목록 표시
      for (var i = 0; i < results.length; i++) {
        var ref = results[i].ref;
        var item = window.searchData.store[ref];
        
        if (!item) continue;
        
        var title = item.title || "제목 없음";
        var excerpt = item.excerpt || "";
        var url = item.url || "#";
        
        // 발췌문 짧게 줄이기
        var shortenedExcerpt = excerpt.split(" ").splice(0, 20).join(" ") + "...";
        
        // 결과 하이라이트
        var regex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
        shortenedExcerpt = shortenedExcerpt.replace(regex, '<mark>$1</mark>');
        
        // 제목에도 하이라이트 적용
        var highlightedTitle = title.replace(regex, '<mark>$1</mark>');
        
        // 키워드 기반 하이라이트 추가
        var keywords = query.split(/\s+/);
        keywords.forEach(function(keyword) {
          if (keyword.length > 1) {
            var keywordRegex = new RegExp('(' + escapeRegExp(keyword) + ')', 'gi');
            shortenedExcerpt = shortenedExcerpt.replace(keywordRegex, '<mark>$1</mark>');
            highlightedTitle = highlightedTitle.replace(keywordRegex, '<mark>$1</mark>');
          }
        });
        
        // 티저 이미지 처리
        var teaser = "";
        if (item.teaser) {
          teaser = '<div class="archive__item-teaser"><img src="' + item.teaser + '" alt=""></div>';
        }
        
        // 태그 표시
        var tagsHtml = "";
        if (item.tagList && item.tagList.length) {
          tagsHtml = '<div class="archive__item-tags">';
          item.tagList.forEach(function(tag) {
            tagsHtml += '<span class="tag">' + tag + '</span>';
          });
          tagsHtml += '</div>';
        }
        
        // 결과 항목 HTML
        var searchitem =
          '<div class="list__item">' +
            '<article class="archive__item" itemscope itemtype="https://schema.org/CreativeWork">' +
              '<h2 class="archive__item-title" itemprop="headline">' +
                '<a href="' + url + '" rel="permalink">' + highlightedTitle + '</a>' +
              '</h2>' +
              teaser +
              '<p class="archive__item-excerpt" itemprop="description">' + shortenedExcerpt + '</p>' +
              tagsHtml +
            '</article>' +
          '</div>';
        
        resultdiv.append(searchitem);
      }
    } catch (e) {
      console.error("검색 중 오류:", e);
      resultdiv.html('<p class="search-error">검색 중 오류가 발생했습니다: ' + e.message + '</p>');
    }
  }
  
  // 정규식 특수문자 이스케이프
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // 검색 옵션이 변경되면 현재 검색어로 다시 검색
  $('input[name="search-option"]').on('change', function() {
    var currentQuery = $('input#search').val().trim();
    if (currentQuery !== '') {
      performSearch(currentQuery);
    }
  });
  
  // URL 검색 파라미터 처리
  function processUrlSearchQuery() {
    if (window.location.pathname.indexOf('/search/') !== -1) {
      var urlParams = new URLSearchParams(window.location.search);
      var queryParam = urlParams.get('q');
      
      if (queryParam && queryParam.trim() !== '') {
        var searchInput = document.getElementById('search');
        if (searchInput) {
          searchInput.value = queryParam;
          performSearch(queryParam.toLowerCase().trim());
        }
      }
    }
  }
}); 