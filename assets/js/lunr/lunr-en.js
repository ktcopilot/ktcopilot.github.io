/*!
 * Lunr languages, `English` language
 * https://github.com/MihaiValentin/lunr-languages
 */
!(function(){
  // lunr이 정의되어 있는지 확인
  if (typeof lunr === 'undefined') {
    console.error('lunr이 로드되지 않았습니다. 검색 기능이 작동하지 않을 수 있습니다.');
    return;
  }
  
  // Token 버전 확인
  var isNewLunr = typeof lunr.Token === 'function';
  console.log("Lunr Token 클래스 사용 가능: " + isNewLunr);
  
  // 간단한 lunr 토큰 래퍼 생성
  var LunrTokenWrapper = function(str) {
    this.str = str || "";
    this.metadata = {};
    
    this.toString = function() {
      return this.str;
    };
    
    this.update = function(fn) {
      this.str = fn(this.str);
      return this;
    };
    
    this.clone = function() {
      return new LunrTokenWrapper(this.str);
    };
    
    this.position = [0, 0];
  };
  
  // 토큰 생성 함수
  var createToken = function(str) {
    if (!str) return null;
    str = String(str).trim().toLowerCase();
    if (str === "") return null;
    
    // lunr 버전에 따라 다르게 처리
    if (isNewLunr) {
      try {
        return new lunr.Token(str);
      } catch (e) {
        return new LunrTokenWrapper(str);
      }
    } else {
      return new LunrTokenWrapper(str);
    }
  };
  
  // 안전 유틸리티 함수 - 모든 토큰 처리에 사용
  var safeProcess = function(token, processor) {
    if (!token) return null;
    
    // 이미 문자열인 경우
    if (typeof token === 'string') {
      var str = token.trim().toLowerCase();
      if (!str) return null;
      
      // 문자열에 직접 함수 적용
      return processor(str);
    }
    
    // 토큰 객체인 경우
    if (token && typeof token.toString === 'function') {
      var tokenStr = token.toString().trim().toLowerCase();
      if (!tokenStr) return null;
      
      // update 메서드가 있는 경우 (표준 lunr.Token)
      if (typeof token.update === 'function') {
        try {
          return token.update(function() { 
            return processor(tokenStr);
          });
        } catch (e) {
          // update 메서드가 실패하면 새 문자열 반환
          return processor(tokenStr);
        }
      } else {
        // update가 없으면 새 문자열 반환
        return processor(tokenStr);
      }
    }
    
    // 그 외 케이스는 null 반환
    return null;
  };
  
  // 안전한 trimmer 함수
  var safeTrimmer = function(token) {
    return safeProcess(token, function(str) {
      return str.trim().toLowerCase();
    });
  };
  
  // 안전한 stemmer 함수 (사용자 정의)
  var safeStemmer = function(token) {
    return safeProcess(token, function(str) {
      // 기본 어간 추출 - 영어 단어만 처리
      if (/^[a-z0-9]+$/.test(str)) {
        var stemmed = str;
        
        // 간단한 어간 추출 규칙 적용
        if (str.length > 3) {
          // 's' 제거 (복수형)
          if (str.endsWith('s')) {
            stemmed = str.substring(0, str.length - 1);
          }
          // 'ing' 제거
          if (str.endsWith('ing')) {
            stemmed = str.substring(0, str.length - 3);
          }
          // 'ed' 제거
          if (str.endsWith('ed')) {
            stemmed = str.substring(0, str.length - 2);
          }
        }
        
        return stemmed;
      }
      
      // 비영어 단어는 그대로 반환
      return str;
    });
  };
  
  // stopWordFilter 안전 구현
  var safeStopWordFilter = function(token) {
    if (!token) return null;
    
    var str = typeof token === 'string' ? token : token.toString();
    str = str.trim().toLowerCase();
    
    // 불용어 목록 - 가장 일반적인 영어 불용어
    var stopWords = {
      'a': true, 'an': true, 'and': true, 'are': true, 'as': true, 'at': true,
      'be': true, 'but': true, 'by': true, 'for': true, 'if': true, 'in': true,
      'into': true, 'is': true, 'it': true, 'no': true, 'not': true, 'of': true,
      'on': true, 'or': true, 'such': true, 'that': true, 'the': true, 'their': true,
      'then': true, 'there': true, 'these': true, 'they': true, 'this': true,
      'to': true, 'was': true, 'will': true, 'with': true
    };
    
    // 불용어인 경우 null 반환
    if (stopWords[str]) return null;
    
    // 불용어가 아닌 경우 원래 토큰 반환
    return token;
  };
  
  // 영어 언어 함수 등록 - 완전 사용자 정의 버전
  lunr.en = function() {
    // 파이프라인 초기화
    this.pipeline.reset();
    
    // 사용자 정의 파이프라인 적용
    this.pipeline.add(safeTrimmer);
    this.pipeline.add(safeStopWordFilter);
    this.pipeline.add(safeStemmer);
    
    // 검색 파이프라인 초기화
    if (this.searchPipeline) {
      this.searchPipeline.reset();
      this.searchPipeline.add(safeStemmer);
    }
  };
  
  console.log("lunr-en.js 로드됨 (완전 사용자 정의 모드)");
})();
