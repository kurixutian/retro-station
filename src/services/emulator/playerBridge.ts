// ============================================================================
// EMULATORJS IFRAME PLAYER HTML BUILDER
// ============================================================================
export function buildPlayerHtml(core: string, romUrl: string, title?: string): string {
  const close = '<' + '/script>';
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none}' +
    '#game{width:100%;height:100%}' +
    '.ejs_virtualGamepad_parent,.ejs_virtualGamepad_parent *,' +
    '.ejs_virtualGamepad_top,.ejs_virtualGamepad_bottom,.ejs_virtualGamepad_left,.ejs_virtualGamepad_right,' +
    '.ejs_dpad_main,.ejs_dpad_vertical,.ejs_dpad_horizontal,' +
    '.ejs_virtual_gamepad,.ejs_menu_bar,.ejs_context_menu,#ejs_menu_bar,' +
    'div[class*="virtualGamepad"],div[class*="dpad"],div[class*="gamepad"],div[class*="touch"]{' +
    'display:none!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important}' +
    '</style></head><body>' +
    '<div id="game"></div><script>' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(core) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_fixedSaveInterval=10000;' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_defaultOptions={"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","settings.fast-forward-ratio":"2","fast-forward-ratio":"2"};' +
    'var _simPressTimes={};' +
    'var _simReleaseTimers={};' +
    'var _dispatchKb=function(kName,down){' +
    '  var keyMap={' +
    '    up:["ArrowUp",38],down:["ArrowDown",40],left:["ArrowLeft",37],right:["ArrowRight",39],' +
    '    actiona:["x",88],a:["x",88],actionb:["z",90],b:["z",90],' +
    '    actionx:["s",83],x:["s",83],actiony:["a",65],y:["a",65],' +
    '    start:["Enter",13],select:["ShiftRight",16],' +
    '    btnl:["q",81],l:["q",81],btnr:["w",87],r:["w",87]' +
    '  };' +
    '  var k=keyMap[kName];' +
    '  if(k){' +
    '    try{' +
    '      var ev=new KeyboardEvent(down?"keydown":"keyup",{' +
    '        key:k[0],code:k[0],bubbles:true,cancelable:true' +
    '      });' +
    '      Object.defineProperty(ev,"keyCode",{get:function(){return k[1];}});' +
    '      Object.defineProperty(ev,"which",{get:function(){return k[1];}});' +
    '      var target=document.getElementById("game")||document.querySelector("canvas")||window;' +
    '      target.dispatchEvent(ev);' +
    '      window.dispatchEvent(ev);' +
    '    }catch(e){}' +
    '  }' +
    '};' +
    'window.simulateButton=function(name,down){' +
    '  var key=String(name).toLowerCase();' +
    '  var map={actionb:0,b:0,actiony:1,y:1,select:2,start:3,up:4,down:5,left:6,right:7,actiona:8,a:8,actionx:9,x:9,btnl:10,l:10,btnr:11,r:11};' +
    '  var idx=map[key];' +
    '  var sendDirect=function(val){' +
    '    if(idx!==undefined&&window.EJS_emulator&&window.EJS_emulator.gameManager){' +
    '      try{window.EJS_emulator.gameManager.simulateInput(0,idx,val?1:0);}catch(e){}' +
    '    }' +
    '    _dispatchKb(key,val);' +
    '  };' +
    '  if(down){' +
    '    if(_simReleaseTimers[key]){clearTimeout(_simReleaseTimers[key]);_simReleaseTimers[key]=null;}' +
    '    _simPressTimes[key]=Date.now();' +
    '    sendDirect(true);' +
    '  }else{' +
    '    var minHold=75;' +
    '    var elapsed=Date.now()-(_simPressTimes[key]||0);' +
    '    if(elapsed<minHold){' +
    '      if(_simReleaseTimers[key])clearTimeout(_simReleaseTimers[key]);' +
    '      _simReleaseTimers[key]=setTimeout(function(){' +
    '        _simReleaseTimers[key]=null;' +
    '        sendDirect(false);' +
    '      },minHold-elapsed);' +
    '    }else{' +
    '      sendDirect(false);' +
    '    }' +
    '  }' +
    '};' +
    'window.setFastForward=function(active,ratio){' +
    '  try{' +
    '    if(window.EJS_emulator&&window.EJS_emulator.gameManager){' +
    '      var gm=window.EJS_emulator.gameManager;' +
    '      var r=typeof ratio==="number"&&ratio>=1?ratio:2;' +
    '      if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(active?r:1);' +
    '      if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(active?1:0);' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window._toU8=function(b){' +
    '  if(!b)return null;' +
    '  if(b instanceof Uint8Array)return b;' +
    '  if(ArrayBuffer.isView(b))return new Uint8Array(b.buffer,b.byteOffset,b.byteLength);' +
    '  if(b instanceof ArrayBuffer)return new Uint8Array(b);' +
    '  if(Array.isArray(b))return new Uint8Array(b);' +
    '  if(typeof b==="object"){var v=Object.values(b);if(v.length>0)return new Uint8Array(v);}' +
    '  return null;' +
    '};' +
    'window.loadSrmData=function(srmBytes,rtcBytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var mod=gm.Module||window.EJS_emulator.Module;' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    var srmArr=window._toU8(srmBytes);' +
    '    var rtcArr=window._toU8(rtcBytes);' +
    '    var writeFiles=function(){' +
    '      if(!fs)return;' +
    '      try{fs.mkdir("/data");}catch(e){}' +
    '      try{fs.mkdir("/data/saves");}catch(e){}' +
    '      var paths=[];' +
    '      if(typeof gm.getSaveFilePath==="function"){try{paths.push(gm.getSaveFilePath());}catch(e){}}' +
    '      if(gm.savePath)paths.push(gm.savePath);' +
    '      if(window.EJS_gameName){' +
    '        paths.push("/data/saves/"+window.EJS_gameName+".srm");' +
    '        paths.push("/data/saves/"+window.EJS_gameName+".sav");' +
    '      }' +
    '      try{' +
    '        var existing=fs.readdir("/data/saves");' +
    '        existing.forEach(function(fn){' +
    '          if(fn!=="."&&fn!==".."&&(fn.endsWith(".srm")||fn.endsWith(".sav")))paths.push("/data/saves/"+fn);' +
    '        });' +
    '      }catch(e){}' +
    '      paths.forEach(function(p){' +
    '        if(!p)return;' +
    '        if(srmArr){try{fs.writeFile(p,srmArr);}catch(e){}}' +
    '        if(rtcArr){var r=p.replace(/\\.[^/.]+$/,".rtc");try{fs.writeFile(r,rtcArr);}catch(e){}}' +
    '      });' +
    '    };' +
    '    var applyWasmMemory=function(){' +
    '      writeFiles();' +
    '      if(typeof gm.loadSaveFiles==="function"){try{gm.loadSaveFiles();}catch(e){}}' +
    '      if(mod&&mod.HEAPU8){' +
    '        var getMemData=mod._retro_get_memory_data||(gm.functions&&gm.functions.getMemoryData);' +
    '        var getMemSize=mod._retro_get_memory_size||(gm.functions&&gm.functions.getMemorySize);' +
    '        if(typeof getMemData==="function"&&typeof getMemSize==="function"){' +
    '          if(srmArr){' +
    '            var ptr=getMemData(0),sz=getMemSize(0);' +
    '            if(ptr&&sz>0)mod.HEAPU8.set(srmArr.subarray(0,Math.min(srmArr.length,sz)),ptr);' +
    '          }' +
    '          if(rtcArr){' +
    '            var rPtr=getMemData(1),rSz=getMemSize(1);' +
    '            if(rPtr&&rSz>0)mod.HEAPU8.set(rtcArr.subarray(0,Math.min(rtcArr.length,rSz)),rPtr);' +
    '          }' +
    '        }' +
    '      }' +
    '    };' +
    '    applyWasmMemory();' +
    '    if(fs&&typeof fs.syncfs==="function"){try{fs.syncfs(false,function(){});}catch(e){}}' +
    '    if(typeof gm.restart==="function"){try{gm.restart();}catch(e){}}' +
    '    else if(mod&&typeof mod._retro_reset==="function"){try{mod._retro_reset();}catch(e){}}' +
    '    setTimeout(applyWasmMemory,120);' +
    '    setTimeout(applyWasmMemory,400);' +
    '    return true;' +
    '  }catch(e){console.error("loadSrmData err",e);return false;}' +
    '};' +
    'window.getSrmData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var mod=gm.Module||window.EJS_emulator.Module;' +
    '    if(typeof gm.saveSaveFiles==="function"){try{gm.saveSaveFiles();}catch(e){}}' +
    '    if(mod&&mod.HEAPU8){' +
    '      var getMemData=mod._retro_get_memory_data||(gm.functions&&gm.functions.getMemoryData);' +
    '      var getMemSize=mod._retro_get_memory_size||(gm.functions&&gm.functions.getMemorySize);' +
    '      if(typeof getMemData==="function"&&typeof getMemSize==="function"){' +
    '        var ptr=getMemData(0),sz=getMemSize(0);' +
    '        if(ptr&&sz>0)return new Uint8Array(mod.HEAPU8.buffer,ptr,sz).slice();' +
    '      }' +
    '    }' +
    '    if(typeof gm.getSaveFile==="function"){' +
    '      var sf=gm.getSaveFile(false);' +
    '      if(sf&&sf.length>0)return new Uint8Array(sf).slice();' +
    '    }' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    var p=typeof gm.getSaveFilePath==="function"?gm.getSaveFilePath():("/data/saves/"+window.EJS_gameName+".srm");' +
    '    if(fs&&fs.readFile){var rf=fs.readFile(p);return rf?new Uint8Array(rf).slice():null;}' +
    '  }catch(e){}' +
    '  return null;' +
    '};' +
    'window.getRtcData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var fs=gm.FS||(window.EJS_emulator.Module&&window.EJS_emulator.Module.FS);' +
    '    var p=typeof gm.getSaveFilePath==="function"?gm.getSaveFilePath():("/data/saves/"+window.EJS_gameName+".srm");' +
    '    var r=p.replace(/\\.[^/.]+$/,".rtc");' +
    '    if(fs&&fs.readFile){var rf=fs.readFile(r);return rf?new Uint8Array(rf).slice():null;}' +
    '  }catch(e){}' +
    '  return null;' +
    '};' +
    'window.loadStateData=function(bytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var arr=window._toU8(bytes);' +
    '    if(!arr||!arr.length)return false;' +
    '    window.EJS_emulator.gameManager.loadState(arr);' +
    '    return true;' +
    '  }catch(e){console.error("loadStateData err",e);return false;}' +
    '};' +
    'window.getStateData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var st=window.EJS_emulator.gameManager.getState();' +
    '    return st?new Uint8Array(st).slice():null;' +
    '  }catch(e){return null;}' +
    '};' +
    'var _lastSrmHash=0;' +
    'window._userInteracted=false;' +
    'var _markInteracted=function(){if(!window._userInteracted){window._userInteracted=true;parent.postMessage({type:"ejs-user-input"},"*");}};' +
    'window.addEventListener("keydown",_markInteracted,true);' +
    'window.addEventListener("pointerdown",_markInteracted,true);' +
    'window.addEventListener("touchstart",_markInteracted,true);' +
    'setInterval(function(){' +
    '  try{' +
    '    if(!window._userInteracted)return;' +
    '    var srm=window.getSrmData&&window.getSrmData();' +
    '    if(!srm||!srm.length)return;' +
    '    var h=0,nonEmpty=false;' +
    '    for(var i=0;i<srm.length;i+=4){' +
    '      var b=srm[i];' +
    '      if(b!==0&&b!==255)nonEmpty=true;' +
    '      h=((h<<5)-h+b)|0;' +
    '    }' +
    '    if(nonEmpty&&h!==_lastSrmHash){' +
    '      _lastSrmHash=h;' +
    '      parent.postMessage({type:"ejs-srm-update",save:Array.from(srm)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '},3000);' +
    'window.EJS_onSaveUpdate=function(e){' +
    '  try{' +
    '    if(window._userInteracted&&e&&e.save){' +
    '      parent.postMessage({type:"ejs-srm-update",save:Array.from(e.save instanceof Uint8Array?e.save:new Uint8Array(e.save))},"*");' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.EJS_onGameStart=function(){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(typeof window.EJS_emulator.toggleVirtualGamepad==="function")window.EJS_emulator.toggleVirtualGamepad(false);' +
    '      if(window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.remove();' +
    '    }' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");if(el)el.remove();' +
    '  }catch(e){}' +
    '  parent.postMessage({type:"ejs-ready"},"*");' +
    '};' +
    'window.setAudioMuted=function(m){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(typeof window.EJS_emulator.setVolume==="function")window.EJS_emulator.setVolume(m?0:1);' +
    '      if(window.EJS_emulator.gameManager&&typeof window.EJS_emulator.gameManager.setVolume==="function")window.EJS_emulator.gameManager.setVolume(m?0:1);' +
    '    }' +
    '  }catch(e){}' +
    '  try{' +
    '    var audios=document.querySelectorAll("audio,video");' +
    '    for(var i=0;i<audios.length;i++){audios[i].muted=m;}' +
    '  }catch(e){}' +
    '};' +
    'setInterval(function(){' +
    '  try{' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '    if(window.EJS_emulator&&window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.style.display="none";' +
    '  }catch(e){}' +
    '},250);' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
