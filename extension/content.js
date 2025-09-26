// Minimal selection responder
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg && msg.type === 'GET_SELECTION'){
    try{
      const sel = window.getSelection?.().toString() || '';
      sendResponse({text: sel});
    }catch(e){
      sendResponse({text: ''});
    }
    return true;
  }
});
