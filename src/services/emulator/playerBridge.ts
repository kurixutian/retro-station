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
    '(function(){' +
    '  window._skipGlDraw=false;' +
    '  var _ogc=HTMLCanvasElement.prototype.getContext;' +
    '  HTMLCanvasElement.prototype.getContext=function(t,a){' +
    '    if(t==="webgl"||t==="experimental-webgl"||t==="webgl2"){' +
    '      a=Object.assign({},a||{},{preserveDrawingBuffer:true,antialias:false,depth:false,stencil:false,powerPreference:"high-performance"});' +
    '    }' +
    '    var ctx=_ogc.call(this,t,a);' +
    '    if(ctx&&(t==="webgl"||t==="experimental-webgl"||t==="webgl2")&&!ctx._rsPatched){' +
    '      ctx._rsPatched=true;' +
    '      var _drawArrays=ctx.drawArrays;' +
    '      var _drawElements=ctx.drawElements;' +
    '      var _texSubImage2D=ctx.texSubImage2D;' +
    '      var _clear=ctx.clear;' +
    '      ctx.drawArrays=function(){if(!window._skipGlDraw)return _drawArrays.apply(this,arguments);};' +
    '      ctx.drawElements=function(){if(!window._skipGlDraw)return _drawElements.apply(this,arguments);};' +
    '      ctx.texSubImage2D=function(){if(!window._skipGlDraw)return _texSubImage2D.apply(this,arguments);};' +
    '      ctx.clear=function(){if(!window._skipGlDraw)return _clear.apply(this,arguments);};' +
    '    }' +
    '    return ctx;' +
    '  };' +
    '})();' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(core) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_fixedSaveInterval=10000;' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_defaultOptions={"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2"};' +
    'var _ffActive=false;' +
    'var _ffRatio=2;' +
    'var _ffTimer=null;' +
    'var _emulatedFrame=0;' +
    'var _lastGlRender=0;' +
    'var _physDown={};' +
    'var _coreDown={};' +
    'var _pressFrame={};' +
    'var _pressTime={};' +
    'var _minFrameTarget={};' +
    'var _releaseTimers={};' +
    'var _origSetTimeout=window.setTimeout.bind(window);' +
    'var _sliceStart=performance.now();' +
    'var _ffBurstCount=0;' +
    'window.setTimeout=function(fn,delay){' +
    '  if(_ffActive&&(delay===undefined||delay<=1)&&typeof fn==="function"&&!fn._rsBypass){' +
    '    var now=performance.now();' +
    '    if(now-_sliceStart>20){_sliceStart=now;_ffBurstCount=0;}' +
    '    _ffBurstCount++;' +
    '    if(_ffBurstCount>=_ffRatio||(now-_sliceStart)>=7.5){' +
    '      _ffBurstCount=0;' +
    '      return _origSetTimeout(function(){' +
    '        _sliceStart=performance.now();' +
    '        fn();' +
    '      },4);' +
    '    }' +
    '  }' +
    '  return _origSetTimeout.apply(window,arguments);' +
    '};' +
    'var _getFrameCount=function(){' +
    '  try{' +
    '    var gm=window.EJS_emulator&&window.EJS_emulator.gameManager;' +
    '    if(gm&&typeof gm.getFrameNum==="function"){' +
    '      var fn=gm.getFrameNum();' +
    '      if(typeof fn==="number"&&fn>_emulatedFrame)_emulatedFrame=fn;' +
    '    }' +
    '  }catch(e){}' +
    '  return _emulatedFrame;' +
    '};' +
    'var _dispatchKb=function(kName,down){' +
    '  var keyMap={' +
    '    up:["ArrowUp",38],down:["ArrowDown",40],left:["ArrowLeft",37],right:["ArrowRight",39],' +
    '    actionb:["x",88],b:["x",88],actiona:["z",90],a:["z",90],' +
    '    actiony:["s",83],y:["s",83],actionx:["a",65],x:["a",65],' +
    '    start:["Enter",13],select:["v",86],' +
    '    btnl:["q",81],l:["q",81],btnr:["e",69],r:["e",69]' +
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
    '    }catch(e){}' +
    '  }' +
    '};' +
    'var _idxToKey={0:"b",1:"y",2:"select",3:"start",4:"up",5:"down",6:"left",7:"right",8:"a",9:"x",10:"l",11:"r"};' +
    'var _keyToIdx={actionb:0,b:0,actiony:1,y:1,select:2,start:3,up:4,down:5,left:6,right:7,actiona:8,a:8,actionx:9,x:9,btnl:10,l:10,btnr:11,r:11};' +
    'var _writeCoreInput=function(idx,val){' +
    '  var numVal=val?1:0;' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    var gm=emu&&emu.gameManager;' +
    '    var mod=(gm&&gm.Module)||(emu&&emu.Module)||window._ejsMod;' +
    '    if(mod&&typeof mod._simulate_input==="function"){' +
    '      mod._simulate_input(0,idx,numVal);' +
    '      return;' +
    '    }' +
    '    if(gm&&typeof gm.simulateInput==="function"){' +
    '      gm.simulateInput(0,idx,numVal);' +
    '      return;' +
    '    }' +
    '  }catch(e){}' +
    '  var kName=_idxToKey[idx];' +
    '  if(kName)_dispatchKb(kName,!!val);' +
    '};' +
    'window._onPreFrame=function(){' +
    '  if(_ffActive&&_ffRatio>1){' +
    '    var now=performance.now();' +
    '    var shouldDraw=((_emulatedFrame%_ffRatio)===0)||(now-_lastGlRender>=15);' +
    '    window._skipGlDraw=!shouldDraw;' +
    '    if(shouldDraw)_lastGlRender=now;' +
    '  }else{' +
    '    window._skipGlDraw=false;' +
    '  }' +
    '  for(var i=0;i<12;i++){' +
    '    if(_coreDown[i])_writeCoreInput(i,1);' +
    '  }' +
    '  return true;' +
    '};' +
    'window._onPostFrame=function(){' +
    '  _emulatedFrame++;' +
    '  window._skipGlDraw=false;' +
    '  for(var i=0;i<12;i++){' +
    '    if(!_physDown[i]&&_coreDown[i]){' +
    '      if(_emulatedFrame>=(_minFrameTarget[i]||0)){' +
    '        _coreDown[i]=false;' +
    '        delete _minFrameTarget[i];' +
    '        if(_releaseTimers[i]){clearTimeout(_releaseTimers[i]);delete _releaseTimers[i];}' +
    '        _writeCoreInput(i,0);' +
    '      }' +
    '    }' +
    '  }' +
    '};' +
    'var _realEjsRuntime=null;' +
    'Object.defineProperty(window,"EJS_Runtime",{' +
    '  configurable:true,enumerable:true,' +
    '  get:function(){return _realEjsRuntime;},' +
    '  set:function(fn){' +
    '    if(typeof fn!=="function"){_realEjsRuntime=fn;return;}' +
    '    _realEjsRuntime=function(mod){' +
    '      if(mod&&typeof mod==="object"){' +
    '        window._ejsMod=mod;' +
    '        var oPre=mod.preMainLoop;' +
    '        var oPost=mod.postMainLoop;' +
    '        mod.preMainLoop=function(){' +
    '          if(typeof oPre==="function"&&oPre()===false)return false;' +
    '          return window._onPreFrame();' +
    '        };' +
    '        mod.postMainLoop=function(){' +
    '          if(typeof oPost==="function")oPost();' +
    '          window._onPostFrame();' +
    '        };' +
    '      }' +
    '      return fn.apply(this,arguments);' +
    '    };' +
    '  }' +
    '});' +
    'window.setButtonBit=function(idx,down){' +
    '  if(idx===undefined||idx===null)return;' +
    '  window._markInteracted&&window._markInteracted();' +
    '  if(_releaseTimers[idx]){clearTimeout(_releaseTimers[idx]);delete _releaseTimers[idx];}' +
    '  var curFrame=_getFrameCount();' +
    '  var now=performance.now();' +
    '  if(down){' +
    '    if(_coreDown[idx]&&!_physDown[idx]){' +
    '      _writeCoreInput(idx,0);' +
    '    }' +
    '    _physDown[idx]=true;' +
    '    _coreDown[idx]=true;' +
    '    _pressFrame[idx]=curFrame;' +
    '    _pressTime[idx]=now;' +
    '    var minFrames=_ffActive?Math.max(2,Math.min(4,_ffRatio)):2;' +
    '    _minFrameTarget[idx]=curFrame+minFrames;' +
    '    _writeCoreInput(idx,1);' +
    '  }else{' +
    '    _physDown[idx]=false;' +
    '    if(!_coreDown[idx])return;' +
    '    var targetFrame=_minFrameTarget[idx]||0;' +
    '    var elapsed=now-(_pressTime[idx]||0);' +
    '    if(curFrame>=targetFrame||elapsed>=42){' +
    '      _coreDown[idx]=false;' +
    '      delete _minFrameTarget[idx];' +
    '      _writeCoreInput(idx,0);' +
    '    }else{' +
    '      var cb=function(){' +
    '        delete _releaseTimers[idx];' +
    '        if(!_physDown[idx]&&_coreDown[idx]){' +
    '          _coreDown[idx]=false;' +
    '          delete _minFrameTarget[idx];' +
    '          _writeCoreInput(idx,0);' +
    '        }' +
    '      };' +
    '      cb._rsBypass=true;' +
    '      _releaseTimers[idx]=_origSetTimeout(cb,Math.max(16,42-elapsed));' +
    '    }' +
    '  }' +
    '};' +
    'window.simulateButton=function(name,down){' +
    '  var key=String(name).toLowerCase();' +
    '  var idx=_keyToIdx[key];' +
    '  if(idx!==undefined){' +
    '    window.setButtonBit(idx,down);' +
    '  }else{' +
    '    _dispatchKb(key,down);' +
    '  }' +
    '};' +
    'var _applyFf=function(){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.gameManager)return;' +
    '    var gm=emu.gameManager;' +
    '    var r=typeof _ffRatio==="number"&&_ffRatio>=1?_ffRatio:2;' +
    '    if(!_ffActive){' +
    '      emu.isFastForward=false;' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        emu.handleSpecialOptions("fastForward","disabled");' +
    '      }' +
    '      if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(1);' +
    '      if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(0);' +
    '    }else{' +
    '      var wasOn=!!emu.isFastForward;' +
    '      emu.isFastForward=true;' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        if(wasOn){' +
    '          emu.handleSpecialOptions("ff-ratio",String(r));' +
    '        }else{' +
    '          emu.handleSpecialOptions("ff-ratio",String(r));' +
    '          emu.handleSpecialOptions("fastForward","enabled");' +
    '        }' +
    '      }else{' +
    '        if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(0);' +
    '        if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(r);' +
    '        setTimeout(function(){' +
    '          try{if(gm&&typeof gm.toggleFastForward==="function")gm.toggleFastForward(1);}catch(e){}' +
    '        },15);' +
    '      }' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.setFastForward=function(active,ratio){' +
    '  _ffActive=!!active;' +
    '  if(typeof ratio==="number"&&ratio>=1)_ffRatio=ratio;' +
    '  _applyFf();' +
    '  if(!window.EJS_emulator||!window.EJS_emulator.gameManager){' +
    '    if(_ffTimer)clearInterval(_ffTimer);' +
    '    var attempts=0;' +
    '    _ffTimer=setInterval(function(){' +
    '      attempts++;' +
    '      if(window.EJS_emulator&&window.EJS_emulator.gameManager){' +
    '        clearInterval(_ffTimer);' +
    '        _ffTimer=null;' +
    '        _applyFf();' +
    '      }else if(attempts>40){' +
    '        clearInterval(_ffTimer);' +
    '        _ffTimer=null;' +
    '      }' +
    '    },250);' +
    '  }' +
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
    'window.captureGameScreenshot=async function(){' +
    '  try{' +
    '    var downscale=function(source){' +
    '      if(!source)return null;' +
    '      var maxW=320;' +
    '      var w=source.width||320,h=source.height||240;' +
    '      if(w>maxW){var s=maxW/w;w=Math.round(w*s);h=Math.round(h*s);}' +
    '      var thumb=document.createElement("canvas");' +
    '      thumb.width=w;thumb.height=h;' +
    '      var ctx=thumb.getContext("2d");' +
    '      if(!ctx)return null;' +
    '      ctx.imageSmoothingEnabled=true;' +
    '      ctx.drawImage(source,0,0,w,h);' +
    '      return thumb.toDataURL("image/jpeg",0.85);' +
    '    };' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&typeof emu.takeScreenshot==="function"){' +
    '      try{' +
    '        var res=await Promise.race([' +
    '          emu.takeScreenshot("canvas","jpeg",1),' +
    '          new Promise(function(r){setTimeout(function(){r(null);},500);})' +
    '        ]);' +
    '        if(res&&res.blob){' +
    '          var blobUrl=URL.createObjectURL(res.blob);' +
    '          var shot=await new Promise(function(resolve){' +
    '            var img=new Image();' +
    '            img.onload=function(){var d=downscale(img);URL.revokeObjectURL(blobUrl);resolve(d);};' +
    '            img.onerror=function(){URL.revokeObjectURL(blobUrl);resolve(null);};' +
    '            img.src=blobUrl;' +
    '          });' +
    '          if(shot)return shot;' +
    '        }' +
    '      }catch(e){}' +
    '    }' +
    '    if(emu&&emu.gameManager&&typeof emu.gameManager.screenshot==="function"){' +
    '      try{' +
    '        var u8=await Promise.race([' +
    '          emu.gameManager.screenshot(),' +
    '          new Promise(function(r){setTimeout(function(){r(null);},500);})' +
    '        ]);' +
    '        if(u8&&u8.length>0){' +
    '          var blob=new Blob([u8],{type:"image/png"});' +
    '          var bUrl=URL.createObjectURL(blob);' +
    '          var shot2=await new Promise(function(resolve){' +
    '            var img=new Image();' +
    '            img.onload=function(){var d=downscale(img);URL.revokeObjectURL(bUrl);resolve(d);};' +
    '            img.onerror=function(){URL.revokeObjectURL(bUrl);resolve(null);};' +
    '            img.src=bUrl;' +
    '          });' +
    '          if(shot2)return shot2;' +
    '        }' +
    '      }catch(e){}' +
    '    }' +
    '    var canvases=Array.from(document.querySelectorAll("canvas"));' +
    '    var best=null,maxArea=0;' +
    '    for(var i=0;i<canvases.length;i++){' +
    '      var c=canvases[i];' +
    '      var area=(c.width||0)*(c.height||0);' +
    '      if(area>maxArea&&c.style.display!=="none"){maxArea=area;best=c;}' +
    '    }' +
    '    if(!best&&emu&&emu.canvas)best=emu.canvas;' +
    '    if(!best)best=document.querySelector("canvas");' +
    '    if(best&&best.width>0&&best.height>0){' +
    '      var dShot=downscale(best);' +
    '      if(dShot)return dShot;' +
    '      return best.toDataURL("image/jpeg",0.85);' +
    '    }' +
    '  }catch(e){console.error("captureGameScreenshot err",e);}' +
    '  return null;' +
    '};' +
    'var _lastSrmHash=0;' +
    'window._userInteracted=false;' +
    'var _markInteracted=window._markInteracted=function(){if(!window._userInteracted){window._userInteracted=true;parent.postMessage({type:"ejs-user-input"},"*");}};' +
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
    'var _vgpCleanCount=0;' +
    'var _vgpCleanIv=_origSetTimeout?setInterval(function(){' +
    '  _vgpCleanCount++;' +
    '  try{' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '    if(window.EJS_emulator&&window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.style.display="none";' +
    '  }catch(e){}' +
    '  if(_vgpCleanCount>20)clearInterval(_vgpCleanIv);' +
    '},500):null;' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
