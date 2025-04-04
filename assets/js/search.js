// 검색 기능 초기화
$(document).ready(function() {
  // 검색 토글 버튼 (돋보기 아이콘) 기능
  $(".search__toggle").on("click", function() {
    $(".search-content").toggleClass("is--visible");
    $(".initial-content").toggleClass("is--hidden");
    
    // 검색창에 포커스
    setTimeout(function() {
      $(".search-content input").focus();
    }, 400);
  });
  
  // 검색 입력 필드에 키보드 입력 이벤트 연결
  $('input#search').on('keyup', function() {
    var resultdiv = $('#results');
    var query = $(this).val().toLowerCase();
    
    // 쿼리가 비어있으면 결과 지우기
    if (query === '') {
      resultdiv.empty();
      return;
    }
    
    // 선택된 검색 옵션 가져오기
    var searchOption = $('input[name="search-option"]:checked').val() || 'all';
    
    // lunr 검색 수행
    if (typeof idx !== 'undefined') {
      var results;
      
      if (searchOption === 'title') {
        // 제목만 검색
        results = idx.search(`title:${query}^10`);
      } else if (searchOption === 'content') {
        // 내용만 검색
        results = idx.search(`excerpt:${query}`);
      } else {
        // 전체 검색 (기본값)
        results = idx.search(query);
      }
      
      // 결과 표시
      resultdiv.empty();
      resultdiv.prepend('<p class="results__found">' + results.length + ' 개의 검색 결과</p>');
      
      // 결과가 없으면 메시지 표시
      if (results.length === 0) {
        resultdiv.append('<p class="no-results">검색 결과가 없습니다.</p>');
        return;
      }
      
      for (var i = 0; i < results.length; i++) {
        var ref = parseInt(results[i].ref); // ref가 문자열일 수 있으므로 정수로 변환
        
        if (store[ref]) {
          var title = store[ref].title;
          var excerpt = store[ref].excerpt || "";
          var url = store[ref].url || "#";
          
          var teaser = "";
          if (store[ref].teaser && store[ref].teaser !== "") {
            teaser = '<div class="archive__item-teaser"><img src="' + store[ref].teaser + '" alt=""></div>';
          }
          
          var searchitem =
            '<div class="list__item">' +
              '<article class="archive__item" itemscope itemtype="https://schema.org/CreativeWork">' +
                '<h2 class="archive__item-title" itemprop="headline">' +
                  '<a href="' + url + '" rel="permalink">' + title + '</a>' +
                '</h2>' +
                teaser +
                '<p class="archive__item-excerpt" itemprop="description">' + 
                  excerpt.split(" ").splice(0,20).join(" ") + '...' + 
                '</p>' +
              '</article>' +
            '</div>';
            
          resultdiv.append(searchitem);
        }
      }
    }
  });
  
  // 검색 옵션이 변경되면 검색을 다시 실행
  $('input[name="search-option"]').on('change', function() {
    $('input#search').trigger('keyup');
  });
  
  // 디버그 정보
  console.log("검색 초기화 완료: 인덱스 " + (typeof idx !== 'undefined' ? '있음' : '없음') + 
    ", store 항목 " + (store ? store.length : '0') + "개");
}); 