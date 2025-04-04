// 검색 기능 초기화
$(document).ready(function() {
  console.log("검색 스크립트 로드됨");
  
  // 메인 네비게이션 검색 폼 관련 로직 추가
  var navSearchForm = document.getElementById("nav-search-form");
  var navSearchInput = document.getElementById("nav-search-input");
  
  if (navSearchForm && navSearchInput) {
    navSearchForm.addEventListener("submit", function(e) {
      var query = navSearchInput.value.trim();
      if (query === "") {
        e.preventDefault(); // 빈 검색어 제출 방지
      }
    });
  }
  
  // 검색 토글 버튼 (돋보기 아이콘) 기능
  $(".search__toggle").on("click", function() {
    $(".search-content").toggleClass("is--visible");
    $(".initial-content").toggleClass("is--hidden");
    
    // 검색창에 포커스
    setTimeout(function() {
      $(".search-content input").focus();
    }, 400);
  });
  
  // 초기 검색 데이터 객체 확인
  if (typeof window.searchData !== 'object') {
    window.searchData = { store: [] };
    console.log("검색 데이터 초기화됨 (search.js)");
  }
  
  // 검색 입력 필드에 키보드 입력 이벤트 연결
  $('input#search').on('keyup', function() {
    var resultdiv = $('#results');
    var query = $(this).val().toLowerCase().trim();
    
    // 검색 초기 메시지 지우기
    $('.search-initial-message').remove();
    
    // 쿼리가 비어있으면 결과 지우기
    if (query === '') {
      resultdiv.empty();
      resultdiv.html('<div class="search-initial-message"><p>검색어를 입력하면 결과가 여기에 표시됩니다.</p></div>');
      return;
    }
    
    // 선택된 검색 옵션 가져오기
    var searchOption = $('input[name="search-option"]:checked').val() || 'all';
    
    // 검색 인덱스 확인
    if (!window.searchData || !window.searchData.store || window.searchData.store.length === 0) {
      console.warn("검색 데이터가 로드되지 않았습니다");
      resultdiv.html('<p class="no-results">검색 인덱스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.</p>');
      return;
    }
    
    // 인덱스 생성이 완료되었는지 확인
    if (!window.searchData.idx) {
      // 인덱스 생성 시도
      createSearchIndex();
      resultdiv.html('<p class="no-results">검색 인덱스를 생성 중입니다. 잠시만 기다려주세요...</p>');
      return;
    }
    
    // lunr 검색 수행
    try {
      console.log("검색 쿼리 실행: " + query + " (옵션: " + searchOption + ")");
      
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
          
          // 단어 단위로 분리하여 검색
          query.split(/\s+/).forEach(function(term) {
            if (term.length > 2) {
              // 정확한 일치에 가중치 부여
              q.term(term, { boost: 10 });
              // 접두사 일치
              q.term(term + '*', { boost: 5 });
              // 퍼지 매칭 (오타 허용)
              q.term(term, { editDistance: 1, boost: 1 });
            }
          });
        });
      }
      
      console.log("검색 결과 수: " + results.length);
      
      // 결과 표시
      resultdiv.empty();
      resultdiv.prepend('<p class="results__found">' + results.length + ' 개의 검색 결과</p>');
      
      // 결과가 없으면 메시지 표시
      if (results.length === 0) {
        resultdiv.append('<p class="no-results">검색 결과가 없습니다. 다른 검색어를 시도해보세요.</p>');
        return;
      }
      
      // 결과 표시
      for (var i = 0; i < results.length; i++) {
        var ref = parseInt(results[i].ref); // ref가 문자열일 수 있으므로 정수로 변환
        
        if (window.searchData.store[ref]) {
          var item = window.searchData.store[ref];
          var title = item.title || "제목 없음";
          var excerpt = item.excerpt || "";
          var url = item.url || "#";
          
          var teaser = "";
          if (item.teaser && item.teaser !== "") {
            teaser = '<div class="archive__item-teaser"><img src="' + item.teaser + '" alt=""></div>';
          }
          
          var searchitem =
            '<div class="list__item">' +
              '<article class="archive__item" itemscope itemtype="https://schema.org/CreativeWork">' +
                '<h2 class="archive__item-title" itemprop="headline">' +
                  '<a href="' + url + '" rel="permalink">' + title + '</a>' +
                '</h2>' +
                teaser +
                '<p class="archive__item-excerpt" itemprop="description">' + 
                  highlight(excerpt, query) + 
                '</p>' +
              '</article>' +
            '</div>';
            
          resultdiv.append(searchitem);
        }
      }
    } catch (e) {
      console.error("검색 중 오류 발생:", e);
      resultdiv.html('<p class="no-results">검색 중 오류가 발생했습니다: ' + e.message + '</p>');
    }
  });
  
  // 검색어 하이라이트 기능
  function highlight(text, search) {
    if (!search) return text.split(" ").splice(0, 20).join(" ") + "...";
    
    // 최대 길이 제한
    var maxLength = 200;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + "...";
    }
    
    // 검색어 하이라이트
    var searchTerms = search.split(/\s+/);
    var result = text;
    
    searchTerms.forEach(function(term) {
      if (term.length > 2) {
        var regex = new RegExp("(" + term + ")", "gi");
        result = result.replace(regex, "<mark>$1</mark>");
      }
    });
    
    return result;
  }
  
  // 검색 인덱스 생성 함수
  function createSearchIndex() {
    if (window.searchData.idx) return; // 이미 생성된 경우 스킵
    
    if (!window.searchData.store || window.searchData.store.length === 0) {
      console.warn("검색 데이터가 비어있어 인덱스를 생성할 수 없습니다.");
      return;
    }
    
    try {
      console.log("search.js에서 lunr 인덱스 생성 시작");
      window.searchData.idx = lunr(function() {
        this.field('title', { boost: 10 });
        this.field('excerpt');
        this.field('categories');
        this.field('tags');
        this.ref('id');
        
        this.pipeline.remove(lunr.trimmer);
        
        for (var i = 0; i < window.searchData.store.length; i++) {
          var doc = {
            'title': window.searchData.store[i].title,
            'excerpt': window.searchData.store[i].excerpt,
            'categories': window.searchData.store[i].categories,
            'tags': window.searchData.store[i].tags,
            'id': i
          };
          this.add(doc);
        }
      });
      console.log("search.js: 인덱스 생성 완료 - " + window.searchData.store.length + "개 항목");
    } catch (e) {
      console.error("search.js: 인덱스 생성 오류", e);
    }
  }
  
  // 검색 옵션이 변경되면 검색을 다시 실행
  $('input[name="search-option"]').on('change', function() {
    $('input#search').trigger('keyup');
  });
  
  // URL 검색 파라미터 처리
  if (window.location.pathname.indexOf('/search/') !== -1) {
    var urlParams = new URLSearchParams(window.location.search);
    var queryParam = urlParams.get('q');
    
    if (queryParam && queryParam.trim() !== '') {
      var searchInput = document.getElementById('search');
      if (searchInput) {
        searchInput.value = queryParam;
        
        // 인덱스가 준비되면 검색 실행
        var checkAndExecuteSearch = function(retryCount) {
          retryCount = retryCount || 0;
          if (window.searchData && window.searchData.idx) {
            $(searchInput).trigger('keyup');
          } else if (retryCount < 10) {
            setTimeout(function() {
              checkAndExecuteSearch(retryCount + 1);
            }, 500);
          }
        };
        
        // 약간 지연 후 검색 실행
        setTimeout(checkAndExecuteSearch, 500);
      }
    }
  }
}); 