// ============================================================================
// EMULATORJS IFRAME PLAYER HTML BUILDER
// ============================================================================
export function buildPlayerHtml(
  core: string,
  romUrl: string,
  title?: string,
  options?: { hdr3d?: boolean }
): string {
  const isGba = core === 'gba' || core === 'mgba';
  const hdr3dDefault = Boolean(options?.hdr3d);
  const close = '<' + '/script>';
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none}' +
    '#game{width:100%;height:100%}' +
    '.ejs_virtualGamepad_parent,.ejs_virtualGamepad_parent *,' +
    '.ejs_virtualGamepad_top,.ejs_virtualGamepad_bottom,.ejs_virtualGamepad_left,.ejs_virtualGamepad_right,' +
    '.ejs_dpad_main,.ejs_dpad_vertical,.ejs_dpad_horizontal,' +
    '.ejs_virtual_gamepad,.ejs_menu_bar,.ejs_context_menu,#ejs_menu_bar,.ejs_message,' +
    'div[class*="virtualGamepad"],div[class*="dpad"],div[class*="gamepad"],div[class*="touch"]{' +
    'display:none!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important}' +
    '</style></head><body>' +
    '<div id="game"></div><script>' +
    '(function(){' +
    '  var origGetCtx=HTMLCanvasElement.prototype.getContext;' +
    '  if(typeof origGetCtx==="function"){' +
    '    HTMLCanvasElement.prototype.getContext=function(type,attrs){' +
    '      if((type==="webgl"||type==="webgl2"||type==="experimental-webgl")&&(!this.dataset||this.dataset.rsShaderOverlay!=="1")){' +
    '        var nextAttrs={};' +
    '        if(attrs&&typeof attrs==="object"){' +
    '          for(var k in attrs){if(Object.prototype.hasOwnProperty.call(attrs,k))nextAttrs[k]=attrs[k];}' +
    '        }' +
    '        nextAttrs.preserveDrawingBuffer=true;' +
    '        return origGetCtx.call(this,type,nextAttrs);' +
    '      }' +
    '      return origGetCtx.apply(this,arguments);' +
    '    };' +
    '  }' +
    '})();' +
    'window._hdr3dEnabled=' + (hdr3dDefault ? 'true' : 'false') + ';' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(core) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_fixedSaveInterval=10000;' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_coreOpts=' + (isGba ? '{"mgba_frameskip":"0","mgba_color_correction":"Auto"}' : '{}') + ';' +
    'window.EJS_defaultOptions={"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"enabled"};' +
    'window.EJS_retroarchOpts=[' +
    '  {name:"video_font_enable",default:false,isString:false},' +
    '  {name:"notification_show_fast_forward",default:false,isString:false},' +
    '  {name:"fastforward_frameskip",default:true,isString:false},' +
    '  {name:"fastforward_ratio",default:0.0,isString:false},' +
    '  {name:"input_poll_type_behavior",default:2,isString:false},' +
    '  {name:"rewind_enable",default:true,isString:false},' +
    '  {name:"rewind_granularity",default:6,isString:false},' +
    '  {name:"rewind_buffer_size",default:20,isString:false}' +
    '];' +
    'var _realGM=undefined;' +
    'Object.defineProperty(window,"EJS_GameManager",{' +
    '  configurable:true,enumerable:true,' +
    '  get:function(){return _realGM;},' +
    '  set:function(cls){' +
    '    _realGM=cls;' +
    '    if(_realGM&&_realGM.prototype&&_realGM.prototype.getRetroArchCfg){' +
    '      var _origCfg=_realGM.prototype.getRetroArchCfg;' +
    '      _realGM.prototype.getRetroArchCfg=function(){' +
    '        var cfg=_origCfg.call(this);' +
    '        cfg=cfg.replace(/fastforward_ratio\\s*=\\s*[^\\n]+/g,"fastforward_ratio = 0.0");' +
    '        cfg=cfg.replace(/input_poll_type_behavior\\s*=\\s*[^\\n]+/g,"input_poll_type_behavior = 2");' +
    '        cfg+="video_font_enable = false\\n";' +
    '        cfg+="notification_show_fast_forward = false\\n";' +
    '        cfg+="fastforward_frameskip = true\\n";' +
    '        cfg+="fastforward_ratio = 0.0\\n";' +
    '        cfg+="input_poll_type_behavior = 2\\n";' +
    '        cfg+="rewind_enable = \\"true\\"\\n";' +
    '        cfg+="rewind_granularity = \\"6\\"\\n";' +
    '        cfg+="rewind_buffer_size = \\"20\\"\\n";' +
    '        return cfg;' +
    '      };' +
    '    }' +
    '  }' +
    '});' +
    'var _audioCtxs=[];' +
    'var _OrigAC=window.AudioContext||window.webkitAudioContext;' +
    'if(_OrigAC){' +
    '  var _PatchedAC=function(){var c=new _OrigAC();_audioCtxs.push(c);return c;};' +
    '  _PatchedAC.prototype=_OrigAC.prototype;' +
    '  window.AudioContext=_PatchedAC;' +
    '  if(window.webkitAudioContext)window.webkitAudioContext=_PatchedAC;' +
    '}' +
    'window.unlockAudio=function(){' +
    '  try{' +
    '    _audioCtxs.forEach(function(c){if(c&&c.state==="suspended"&&typeof c.resume==="function")c.resume().catch(function(){});});' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&emu.Module&&emu.Module.AL&&emu.Module.AL.currentCtx&&emu.Module.AL.currentCtx.ctx){' +
    '      var actx=emu.Module.AL.currentCtx.ctx;' +
    '      if(actx&&actx.state==="suspended"&&typeof actx.resume==="function")actx.resume().catch(function(){});' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'var _simPressTimes={};' +
    'var _simReleaseTimers={};' +
    'var _dispatchKb=function(kName,down){' +
    '  var keyMap={' +
    '    up:["ArrowUp",38],down:["ArrowDown",40],left:["ArrowLeft",37],right:["ArrowRight",39],' +
    '    actiona:["x",88],a:["x",88],actionb:["z",90],b:["z",90],' +
    '    actionx:["s",83],x:["s",83],actiony:["a",65],y:["a",65],' +
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
    'var _btnIndexMap={actionb:0,b:0,actiony:1,y:1,select:2,start:3,up:4,down:5,left:6,right:7,actiona:8,a:8,actionx:9,x:9,btnl:10,l:10,btnr:11,r:11};' +
    'var _btnDownFrame={};' +
    'var _btnReleaseRaf={};' +
    'var _btnReleaseTimer={};' +
    'var _clearPendingRelease=function(idx){' +
    '  if(_btnReleaseRaf[idx]){cancelAnimationFrame(_btnReleaseRaf[idx]);delete _btnReleaseRaf[idx];}' +
    '  if(_btnReleaseTimer[idx]){clearTimeout(_btnReleaseTimer[idx]);delete _btnReleaseTimer[idx];}' +
    '};' +
    'var _getFrameNum=function(gm){' +
    '  try{return gm&&typeof gm.getFrameNum==="function"?gm.getFrameNum():-1;}catch(e){return -1;}' +
    '};' +
    'var _commitButtonBit=function(idx,down){' +
    '  var emu=window.EJS_emulator;' +
    '  var gm=emu&&emu.gameManager;' +
    '  if(!gm||typeof gm.simulateInput!=="function")return false;' +
    '  _clearPendingRelease(idx);' +
    '  if(down){' +
    '    _btnDownFrame[idx]=_getFrameNum(gm);' +
    '    gm.simulateInput(0,idx,1);' +
    '    return true;' +
    '  }' +
    '  var downFrame=_btnDownFrame[idx];' +
    '  var curFrame=_getFrameNum(gm);' +
    '  if(curFrame===-1||downFrame===undefined||curFrame>downFrame){' +
    '    delete _btnDownFrame[idx];' +
    '    gm.simulateInput(0,idx,0);' +
    '    return true;' +
    '  }' +
    '  var waitNextFrame=function(){' +
    '    delete _btnReleaseRaf[idx];' +
    '    var f=_getFrameNum(gm);' +
    '    if(f===-1||f>downFrame){' +
    '      _clearPendingRelease(idx);' +
    '      delete _btnDownFrame[idx];' +
    '      try{gm.simulateInput(0,idx,0);}catch(e){}' +
    '      return;' +
    '    }' +
    '    _btnReleaseRaf[idx]=requestAnimationFrame(waitNextFrame);' +
    '  };' +
    '  _btnReleaseRaf[idx]=requestAnimationFrame(waitNextFrame);' +
    '  _btnReleaseTimer[idx]=setTimeout(function(){' +
    '    _clearPendingRelease(idx);' +
    '    delete _btnDownFrame[idx];' +
    '    try{gm.simulateInput(0,idx,0);}catch(e){}' +
    '  },34);' +
    '  return true;' +
    '};' +
    'window.simulateButton=function(name,down){' +
    '  var key=String(name).toLowerCase();' +
    '  var idx=_btnIndexMap[key];' +
    '  window._markInteracted&&window._markInteracted();' +
    '  if(down&&!window._audioUnlocked){' +
    '    window._audioUnlocked=true;' +
    '    window.unlockAudio&&window.unlockAudio();' +
    '  }' +
    '  var handled=false;' +
    '  if(idx!==undefined){' +
    '    try{handled=_commitButtonBit(idx,down);}catch(e){}' +
    '  }' +
    '  if(!handled){' +
    '    _dispatchKb(key,down);' +
    '  }' +
    '};' +
    'window.setButtonBit=function(idx,down){' +
    '  window._markInteracted&&window._markInteracted();' +
    '  if(down&&!window._audioUnlocked){window._audioUnlocked=true;window.unlockAudio&&window.unlockAudio();}' +
    '  try{' +
    '    if(_commitButtonBit(idx,down))return;' +
    '  }catch(e){}' +
    '  var revMap={0:"actionb",1:"actiony",2:"select",3:"start",4:"up",5:"down",6:"left",7:"right",8:"actiona",9:"actionx",10:"btnl",11:"btnr"};' +
    '  var name=revMap[idx];' +
    '  if(name)_dispatchKb(name,down);' +
    '};' +
    'window.setRewind=function(active){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    var gm=emu.gameManager;' +
    '    var v=active?1:0;' +
    '    if(gm){' +
    '      if(typeof gm.simulateInput==="function"){try{gm.simulateInput(0,28,v);}catch(e){}}' +
    '      if(gm.functions&&typeof gm.functions.toggleRewind==="function"){try{gm.functions.toggleRewind(v);}catch(e){}}' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.addEventListener("message",function(ev){' +
    '  try{' +
    '    if(ev.data&&ev.data.type==="ejs-set-rewind"){' +
    '      window.setRewind(!!ev.data.active);' +
    '    }else if(ev.data&&ev.data.type==="ejs-set-hdr3d"){' +
    '      if(typeof window.setHdr3dShader==="function")window.setHdr3dShader(!!ev.data.active);' +
    '    }' +
    '  }catch(e){}' +
    '});' +
    'window.setFastForward=function(active,ratio){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    var gm=emu.gameManager;' +
    '    var r=typeof ratio==="number"&&ratio>=1?ratio:2;' +
    '    if(active){' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        emu.handleSpecialOptions("ff-ratio",String(r));' +
    '        if(!emu.isFastForward)emu.handleSpecialOptions("fastForward","enabled");' +
    '      }' +
    '      if(gm){' +
    '        if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(0);' +
    '        if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(r);' +
    '        setTimeout(function(){' +
    '          try{' +
    '            if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(1);' +
    '            if(emu)emu.isFastForward=true;' +
    '          }catch(e){}' +
    '        },15);' +
    '      }' +
    '    }else{' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        emu.handleSpecialOptions("fastForward","disabled");' +
    '      }' +
    '      if(gm){' +
    '        if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(1);' +
    '        if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(0);' +
    '      }' +
    '      emu.isFastForward=false;' +
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
    '      if(c.dataset&&c.dataset.rsShaderOverlay==="1")continue;' +
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
    'window._saveIv=setInterval(function(){' +
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
    '  if(window._hdr3dEnabled&&typeof window.setHdr3dShader==="function"){window.setHdr3dShader(true);}' +
    '  parent.postMessage({type:"ejs-ready"},"*");' +
    '};' +
    'var _lastFpsFrame=null,_lastFpsTime=0,_lastFpsVal=60;' +
    'window.getMeasuredFps=function(){' +
    '  try{' +
    '    var gm=window.EJS_emulator&&window.EJS_emulator.gameManager;' +
    '    if(!gm||typeof gm.getFrameNum!=="function")return 60;' +
    '    var f=gm.getFrameNum(),t=performance.now();' +
    '    if(_lastFpsFrame!==null&&t-_lastFpsTime>=250){' +
    '      var df=f-_lastFpsFrame,dt=t-_lastFpsTime;' +
    '      if(df>0&&dt>0)_lastFpsVal=Math.min(60,Math.max(1,Math.round((df*1000)/dt)));' +
    '      _lastFpsFrame=f;_lastFpsTime=t;' +
    '    }else if(_lastFpsFrame===null){' +
    '      _lastFpsFrame=f;_lastFpsTime=t;' +
    '    }' +
    '    return _lastFpsVal;' +
    '  }catch(e){return 60;}' +
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
    'window.destroyEmulator=function(){' +
    '  try{' +
    '    if(typeof window._destroyHdr3dShader==="function")window._destroyHdr3dShader();' +
    '    if(window._saveIv)clearInterval(window._saveIv);' +
    '    if(window._vgpCleanIv)clearInterval(window._vgpCleanIv);' +
    '    if(window.EJS_emulator){' +
    '      var emu=window.EJS_emulator;' +
    '      if(emu.gameManager&&typeof emu.gameManager.toggleMainLoop==="function"){' +
    '        emu.gameManager.toggleMainLoop(0);' +
    '      }' +
    '      if(emu.Module&&typeof emu.Module.abort==="function"){' +
    '        try{emu.Module.abort();}catch(e){}' +
    '      }' +
    '    }' +
    '    if(_audioCtxs){' +
    '      _audioCtxs.forEach(function(c){try{c.close();}catch(e){}});' +
    '      _audioCtxs=[];' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    '(function(){' +
    '  var _overlay=null,_gl=null,_tex=null,_vbo=null;' +
    '  var _progPrep=null,_progBlur=null,_progComp=null,_locs=null;' +
    '  var _fboA=null,_texA=null,_fboB=null,_texB=null,_fboW=0,_fboH=0;' +
    '  var _ctxLost=false,_glFailed=false,_destroyed=false,_rafId=0;' +
    '  var _texW=0,_texH=0,_lastL=-1,_lastT=-1,_lastW=-1,_lastH=-1,_lastBW=-1,_lastBH=-1;' +
    '  var _hasRtc=false,_rtcProbeDone=false,_lastLightCheck=0;' +
    '  var _lightState={sx:-0.68,sy:0.73,exp:0.68,bloom:0.68,sh:0.88,cool:[0.78,0.89,1.14],hi:[1.18,1.01,0.78]};' +
    '  var _checkMemoryRtc=function(){' +
    '    try{' +
    '      var emu=window.EJS_emulator,gm=emu&&emu.gameManager,mod=(gm&&gm.Module)||(emu&&emu.Module);' +
    '      if(mod&&typeof mod._retro_get_memory_size==="function"&&mod._retro_get_memory_size(1)>0)return true;' +
    '      if(gm&&gm.functions&&typeof gm.functions.getMemorySize==="function"&&gm.functions.getMemorySize(1)>0)return true;' +
    '      var rtc=window.getRtcData&&window.getRtcData();' +
    '      if(rtc&&rtc.length>0)return true;' +
    '    }catch(e){}' +
    '    return false;' +
    '  };' +
    '  var _probeRtcSupport=function(){' +
    '    if(_checkMemoryRtc()){_hasRtc=true;_rtcProbeDone=true;return;}' +
    '    if(_rtcProbeDone)return;_rtcProbeDone=true;' +
    '    try{' +
    '      var url=window.EJS_gameUrl;' +
    '      if(!url||typeof fetch!=="function"||url.indexOf("blob:")!==0)return;' +
    '      fetch(url).then(function(res){' +
    '        if(!res||!res.body||typeof res.body.getReader!=="function")return null;' +
    '        var r=res.body.getReader();' +
    '        return r.read().then(function(ch){try{r.cancel();}catch(e){}return ch&&ch.value?ch.value:null;});' +
    '      }).then(function(b){' +
    '        if(!b||b.length<330)return;' +
    '        var core=String(window.EJS_core||"").toLowerCase();' +
    '        if(core==="gambatte"||core==="gb"||core==="gbc"){' +
    '          var t=b[0x0147];' +
    '          if(t===0x0F||t===0x10)_hasRtc=true;' +
    '        }else if(core==="mgba"||core==="gba"){' +
    '          var code=String.fromCharCode(b[0xAC]||0,b[0xAD]||0,b[0xAE]||0);' +
    '          if(["AXV","AXP","BPE","U3I","U32","U33","BKA","BR4"].indexOf(code)!==-1)_hasRtc=true;' +
    '        }' +
    '      }).catch(function(){});' +
    '    }catch(e){}' +
    '  };' +
    '  var _rtcKeys=[' +
    '    {h:0.0,sx:-0.50,sy:0.86,exp:0.56,bloom:0.95,sh:0.90,cool:[0.74,0.84,1.16],hi:[1.02,1.04,1.14]},' +
    '    {h:5.5,sx:-0.85,sy:0.52,exp:0.60,bloom:0.82,sh:0.86,cool:[0.78,0.86,1.14],hi:[1.12,0.98,0.90]},' +
    '    {h:8.5,sx:-0.86,sy:0.51,exp:0.66,bloom:0.65,sh:0.88,cool:[0.80,0.90,1.12],hi:[1.15,1.02,0.84]},' +
    '    {h:13.0,sx:-0.28,sy:0.96,exp:0.70,bloom:0.58,sh:0.86,cool:[0.82,0.91,1.10],hi:[1.14,1.04,0.86]},' +
    '    {h:17.5,sx:0.86,sy:0.51,exp:0.66,bloom:0.78,sh:0.90,cool:[0.76,0.85,1.14],hi:[1.24,0.96,0.70]},' +
    '    {h:19.5,sx:0.62,sy:0.78,exp:0.57,bloom:0.92,sh:0.90,cool:[0.75,0.85,1.16],hi:[1.04,1.02,1.12]},' +
    '    {h:24.0,sx:-0.50,sy:0.86,exp:0.56,bloom:0.95,sh:0.90,cool:[0.74,0.84,1.16],hi:[1.02,1.04,1.14]}' +
    '  ];' +
    '  var _updateLight=function(now){' +
    '    if(now-_lastLightCheck<1000)return;' +
    '    _lastLightCheck=now;' +
    '    if(!_hasRtc&&_checkMemoryRtc())_hasRtc=true;' +
    '    if(!_hasRtc){' +
    '      _lightState={sx:-0.68,sy:0.73,exp:0.68,bloom:0.68,sh:0.88,cool:[0.78,0.89,1.14],hi:[1.18,1.01,0.78]};' +
    '      return;' +
    '    }' +
    '    var d=new Date(),hr=d.getHours()+d.getMinutes()/60.0;' +
    '    var a=_rtcKeys[0],b=_rtcKeys[_rtcKeys.length-1];' +
    '    for(var i=0;i<_rtcKeys.length-1;i++){' +
    '      if(hr>=_rtcKeys[i].h&&hr<=_rtcKeys[i+1].h){a=_rtcKeys[i];b=_rtcKeys[i+1];break;}' +
    '    }' +
    '    var t=b.h>a.h?(hr-a.h)/(b.h-a.h):0;' +
    '    var lerp=function(x,y){return x+(y-x)*t;};' +
    '    _lightState={' +
    '      sx:lerp(a.sx,b.sx),sy:lerp(a.sy,b.sy),exp:lerp(a.exp,b.exp),bloom:lerp(a.bloom,b.bloom),sh:lerp(a.sh,b.sh),' +
    '      cool:[lerp(a.cool[0],b.cool[0]),lerp(a.cool[1],b.cool[1]),lerp(a.cool[2],b.cool[2])],' +
    '      hi:[lerp(a.hi[0],b.hi[0]),lerp(a.hi[1],b.hi[1]),lerp(a.hi[2],b.hi[2])]' +
    '    };' +
    '  };' +
    '  var _vsSrc=' +
    '    "attribute vec2 a_pos;\\n"+' +
    '    "varying vec2 v_uv;\\n"+' +
    '    "void main(){\\n"+' +
    '    "  v_uv=a_pos*0.5+0.5;\\n"+' +
    '    "  gl_Position=vec4(a_pos,0.0,1.0);\\n"+' +
    '    "}";' +
    '  var _fsPrep=' +
    '    "precision mediump float;\\n"+' +
    '    "varying vec2 v_uv;\\n"+' +
    '    "uniform sampler2D u_tex;\\n"+' +
    '    "uniform vec2 u_step;\\n"+' +
    '    "uniform vec2 u_sunDir;\\n"+' +
    '    "float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}\\n"+' +
    '    "float occTap(vec2 uv,vec2 off,vec2 bodyOff,vec3 c,float hc){\\n"+' +
    '    "  vec3 c1=texture2D(u_tex,clamp(uv+off,vec2(0.0),vec2(1.0))).rgb;\\n"+' +
    '    "  vec3 c2=texture2D(u_tex,clamp(uv+off+bodyOff,vec2(0.0),vec2(1.0))).rgb;\\n"+' +
    '    "  float hk=luma(c1);\\n"+' +
    '    "  float edge=smoothstep(0.14,0.38,hc-hk)*smoothstep(0.28,0.50,hc);\\n"+' +
    '    "  float body=smoothstep(0.12,0.34,length(c2-c));\\n"+' +
    '    "  return edge*body;\\n"+' +
    '    "}\\n"+' +
    '    "void main(){\\n"+' +
    '    "  vec3 c=texture2D(u_tex,v_uv).rgb;\\n"+' +
    '    "  float hc=luma(c);\\n"+' +
    '    "  float sat=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));\\n"+' +
    '    "  float uiGuard=1.0-smoothstep(0.78,0.88,hc)*(1.0-smoothstep(0.04,0.12,sat));\\n"+' +
    '    "  vec2 dir=normalize(u_sunDir)*u_step;\\n"+' +
    '    "  vec2 bo=dir*1.8;\\n"+' +
    '    "  float acc=0.0;\\n"+' +
    '    "  acc+=occTap(v_uv,dir*1.2,bo,c,hc)*0.30;\\n"+' +
    '    "  acc+=occTap(v_uv,dir*2.4,bo,c,hc)*0.27;\\n"+' +
    '    "  acc+=occTap(v_uv,dir*4.0,bo,c,hc)*0.22;\\n"+' +
    '    "  acc+=occTap(v_uv,dir*5.8,bo,c,hc)*0.13;\\n"+' +
    '    "  acc+=occTap(v_uv,dir*7.6,bo,c,hc)*0.08;\\n"+' +
    '    "  gl_FragColor=vec4(c,clamp(acc*uiGuard*2.35,0.0,1.0));\\n"+' +
    '    "}";' +
    '  var _fsBlur=' +
    '    "precision mediump float;\\n"+' +
    '    "varying vec2 v_uv;\\n"+' +
    '    "uniform sampler2D u_tex;\\n"+' +
    '    "uniform vec2 u_dir;\\n"+' +
    '    "void main(){\\n"+' +
    '    "  vec4 sum=vec4(0.0);\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv-u_dir*4.0,vec2(0.0),vec2(1.0)))*0.05;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv-u_dir*3.0,vec2(0.0),vec2(1.0)))*0.09;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv-u_dir*2.0,vec2(0.0),vec2(1.0)))*0.12;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv-u_dir*1.0,vec2(0.0),vec2(1.0)))*0.15;\\n"+' +
    '    "  sum+=texture2D(u_tex,v_uv)*0.18;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv+u_dir*1.0,vec2(0.0),vec2(1.0)))*0.15;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv+u_dir*2.0,vec2(0.0),vec2(1.0)))*0.12;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv+u_dir*3.0,vec2(0.0),vec2(1.0)))*0.09;\\n"+' +
    '    "  sum+=texture2D(u_tex,clamp(v_uv+u_dir*4.0,vec2(0.0),vec2(1.0)))*0.05;\\n"+' +
    '    "  gl_FragColor=sum;\\n"+' +
    '    "}";' +
    '  var _fsComp=' +
    '    "precision mediump float;\\n"+' +
    '    "varying vec2 v_uv;\\n"+' +
    '    "uniform sampler2D u_tex;\\n"+' +
    '    "uniform sampler2D u_blur;\\n"+' +
    '    "uniform vec2 u_srcSize;\\n"+' +
    '    "uniform vec2 u_dstSize;\\n"+' +
    '    "uniform vec2 u_blurStep;\\n"+' +
    '    "uniform vec3 u_coolTint;\\n"+' +
    '    "uniform vec3 u_hiTint;\\n"+' +
    '    "uniform vec3 u_toneParams;\\n"+' +
    '    "float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}\\n"+' +
    '    "vec3 acesFilm(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}\\n"+' +
    '    "vec2 sharpUv(vec2 uv){\\n"+' +
    '    "  vec2 sc=max(u_dstSize/max(u_srcSize,vec2(1.0)),vec2(1.0));\\n"+' +
    '    "  vec2 tc=uv*u_srcSize-0.5;\\n"+' +
    '    "  vec2 fl=floor(tc);\\n"+' +
    '    "  vec2 fr=tc-fl;\\n"+' +
    '    "  vec2 aa=clamp((fr-0.5)*sc+0.5,0.0,1.0);\\n"+' +
    '    "  return clamp((fl+aa+0.5)/u_srcSize,vec2(0.0),vec2(1.0));\\n"+' +
    '    "}\\n"+' +
    '    "vec3 glowSample(vec2 uv){\\n"+' +
    '    "  vec3 s=texture2D(u_blur,clamp(uv,vec2(0.0),vec2(1.0))).rgb;\\n"+' +
    '    "  float w=smoothstep(0.76,0.99,luma(s));\\n"+' +
    '    "  return pow(max(s,vec3(0.0001)),vec3(2.2))*w;\\n"+' +
    '    "}\\n"+' +
    '    "void main(){\\n"+' +
    '    "  float v=v_uv.y;\\n"+' +
    '    "  float pv=clamp(v*(0.94+0.06*v),0.0,1.0);\\n"+' +
    '    "  float ps=0.93+0.07*v;\\n"+' +
    '    "  float pu=clamp((v_uv.x-0.5)*ps+0.5,0.0,1.0);\\n"+' +
    '    "  vec2 puv=vec2(pu,pv);\\n"+' +
    '    "  float dof=smoothstep(0.22,0.49,abs(v-0.47));\\n"+' +
    '    "  vec3 cSharp=texture2D(u_tex,sharpUv(puv)).rgb;\\n"+' +
    '    "  vec4 blurS=texture2D(u_blur,puv);\\n"+' +
    '    "  vec3 base=mix(cSharp,blurS.rgb,dof*0.86);\\n"+' +
    '    "  vec3 lin=pow(max(base,vec3(0.0001)),vec3(2.65))*u_toneParams.x;\\n"+' +
    '    "  float tm=smoothstep(0.05,0.60,luma(lin));\\n"+' +
    '    "  lin*=mix(u_coolTint,u_hiTint,tm);\\n"+' +
    '    "  vec3 bl=(glowSample(puv)+glowSample(puv+vec2(-u_blurStep.x,0.0))+glowSample(puv+vec2(u_blurStep.x,0.0))+glowSample(puv+vec2(0.0,-u_blurStep.y))+glowSample(puv+vec2(0.0,u_blurStep.y)))*0.2;\\n"+' +
    '    "  lin+=bl*(u_toneParams.y*0.58)*u_hiTint;\\n"+' +
    '    "  float dayMask=smoothstep(0.42,0.56,u_toneParams.x);\\n"+' +
    '    "  float rayCoord=v_uv.x*0.74+(1.0-v)*0.67;\\n"+' +
    '    "  float rayMask=smoothstep(0.35,0.92,0.5+0.5*sin(rayCoord*18.0+0.5)*cos(rayCoord*7.0));\\n"+' +
    '    "  float sunFade=smoothstep(0.25,0.98,v)*smoothstep(0.95,0.08,v_uv.x);\\n"+' +
    '    "  lin*=1.0+rayMask*sunFade*0.24*dayMask;\\n"+' +
    '    "  float ll=luma(lin);\\n"+' +
    '    "  lin=max(mix(vec3(ll),lin,1.24),vec3(0.0));\\n"+' +
    '    "  vec3 mapped=mix(lin,acesFilm(lin*1.10)/0.8400,0.28);\\n"+' +
    '    "  vec3 srgb=pow(clamp(mapped,0.0,1.0),vec3(1.0/2.2));\\n"+' +
    '    "  float sl=luma(srgb);\\n"+' +
    '    "  srgb*=1.0-0.42*(1.0-smoothstep(0.04,0.68,sl));\\n"+' +
    '    "  float shPow=pow(max(blurS.a,0.0001),0.68);\\n"+' +
    '    "  float sf=clamp(shPow*(1.0-dof*0.35)*u_toneParams.z,0.0,0.86);\\n"+' +
    '    "  srgb*=mix(vec3(1.0),vec3(0.14,0.19,0.34),sf);\\n"+' +
    '    "  vec2 vc=v_uv-0.5;\\n"+' +
    '    "  float vig=1.0-smoothstep(0.28,0.82,dot(vc,vc)*1.40)*0.18;\\n"+' +
    '    "  gl_FragColor=vec4(clamp(srgb*vig,0.0,1.0),1.0);\\n"+' +
    '    "}";' +
    '  var _findSrc=function(){' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&emu.canvas&&(!emu.canvas.dataset||emu.canvas.dataset.rsShaderOverlay!=="1")&&emu.canvas.width>0&&emu.canvas.height>0&&emu.canvas.style.display!=="none")return emu.canvas;' +
    '    var list=document.querySelectorAll("canvas"),best=null,maxA=0;' +
    '    for(var i=0;i<list.length;i++){' +
    '      var c=list[i];' +
    '      if((c.dataset&&c.dataset.rsShaderOverlay==="1")||c.style.display==="none")continue;' +
    '      var a=(c.width||0)*(c.height||0);' +
    '      if(a>maxA){maxA=a;best=c;}' +
    '    }' +
    '    return best;' +
    '  };' +
    '  var _resetGlRefs=function(){_gl=null;_progPrep=null;_progBlur=null;_progComp=null;_tex=null;_vbo=null;_fboA=null;_texA=null;_fboB=null;_texB=null;_locs=null;_texW=0;_texH=0;_fboW=0;_fboH=0;};' +
    '  var _ensureOverlay=function(){' +
    '    if(_overlay)return _overlay;' +
    '    var c=document.createElement("canvas");' +
    '    c.dataset.rsShaderOverlay="1";' +
    '    c.setAttribute("aria-hidden","true");' +
    '    c.style.cssText="position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:9999;display:none;margin:0;padding:0;border:0;";' +
    '    c.addEventListener("webglcontextlost",function(e){' +
    '      e.preventDefault();_ctxLost=true;_resetGlRefs();if(_overlay)_overlay.style.display="none";' +
    '    },false);' +
    '    c.addEventListener("webglcontextrestored",function(){' +
    '      _ctxLost=false;if(window._hdr3dEnabled&&!_destroyed)_renderFrame();' +
    '    },false);' +
    '    (document.body||document.documentElement).appendChild(c);' +
    '    _overlay=c;' +
    '    return c;' +
    '  };' +
    '  var _compile=function(gl,type,src){' +
    '    var s=gl.createShader(type);' +
    '    gl.shaderSource(s,src);' +
    '    gl.compileShader(s);' +
    '    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){try{console.warn("HDR3D compile:",gl.getShaderInfoLog(s));}catch(e){}gl.deleteShader(s);return null;}' +
    '    return s;' +
    '  };' +
    '  var _linkProg=function(gl,vs,fsSrc){' +
    '    var fs=_compile(gl,gl.FRAGMENT_SHADER,fsSrc);' +
    '    if(!fs)return null;' +
    '    var p=gl.createProgram();' +
    '    gl.attachShader(p,vs);gl.attachShader(p,fs);' +
    '    gl.bindAttribLocation(p,0,"a_pos");' +
    '    gl.linkProgram(p);' +
    '    gl.deleteShader(fs);' +
    '    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){gl.deleteProgram(p);return null;}' +
    '    return p;' +
    '  };' +
    '  var _makeTarget=function(gl,w,h){' +
    '    var t=gl.createTexture();' +
    '    gl.bindTexture(gl.TEXTURE_2D,t);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);' +
    '    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);' +
    '    var f=gl.createFramebuffer();' +
    '    gl.bindFramebuffer(gl.FRAMEBUFFER,f);' +
    '    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);' +
    '    var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;' +
    '    gl.bindFramebuffer(gl.FRAMEBUFFER,null);' +
    '    if(!ok){gl.deleteFramebuffer(f);gl.deleteTexture(t);return null;}' +
    '    return {fbo:f,tex:t};' +
    '  };' +
    '  var _ensureFbos=function(gl,fw,fh){' +
    '    if(_fboA&&_fboB&&_fboW===fw&&_fboH===fh)return true;' +
    '    if(_fboA){try{gl.deleteFramebuffer(_fboA);}catch(e){} _fboA=null;}' +
    '    if(_texA){try{gl.deleteTexture(_texA);}catch(e){} _texA=null;}' +
    '    if(_fboB){try{gl.deleteFramebuffer(_fboB);}catch(e){} _fboB=null;}' +
    '    if(_texB){try{gl.deleteTexture(_texB);}catch(e){} _texB=null;}' +
    '    var a=_makeTarget(gl,fw,fh),b=_makeTarget(gl,fw,fh);' +
    '    if(!a||!b){if(a){gl.deleteFramebuffer(a.fbo);gl.deleteTexture(a.tex);}if(b){gl.deleteFramebuffer(b.fbo);gl.deleteTexture(b.tex);}return false;}' +
    '    _fboA=a.fbo;_texA=a.tex;_fboB=b.fbo;_texB=b.tex;_fboW=fw;_fboH=fh;' +
    '    return true;' +
    '  };' +
    '  var _initGl=function(){' +
    '    if(_gl)return true;' +
    '    if(_glFailed||_ctxLost)return false;' +
    '    var ov=_ensureOverlay();' +
    '    var opts={alpha:false,antialias:false,depth:false,stencil:false,powerPreference:"high-performance"};' +
    '    var gl=ov.getContext("webgl",opts)||ov.getContext("experimental-webgl",opts);' +
    '    if(!gl){_glFailed=true;return false;}' +
    '    var vs=_compile(gl,gl.VERTEX_SHADER,_vsSrc);' +
    '    if(!vs){_glFailed=true;return false;}' +
    '    var pPrep=_linkProg(gl,vs,_fsPrep);' +
    '    var pBlur=_linkProg(gl,vs,_fsBlur);' +
    '    var pComp=_linkProg(gl,vs,_fsComp);' +
    '    gl.deleteShader(vs);' +
    '    if(!pPrep||!pBlur||!pComp){if(pPrep)gl.deleteProgram(pPrep);if(pBlur)gl.deleteProgram(pBlur);if(pComp)gl.deleteProgram(pComp);_glFailed=true;return false;}' +
    '    var vbo=gl.createBuffer();' +
    '    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);' +
    '    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);' +
    '    gl.enableVertexAttribArray(0);' +
    '    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);' +
    '    var tex=gl.createTexture();' +
    '    gl.activeTexture(gl.TEXTURE0);' +
    '    gl.bindTexture(gl.TEXTURE_2D,tex);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);' +
    '    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);' +
    '    gl.useProgram(pPrep);gl.uniform1i(gl.getUniformLocation(pPrep,"u_tex"),0);' +
    '    gl.useProgram(pBlur);gl.uniform1i(gl.getUniformLocation(pBlur,"u_tex"),0);' +
    '    gl.useProgram(pComp);gl.uniform1i(gl.getUniformLocation(pComp,"u_tex"),0);gl.uniform1i(gl.getUniformLocation(pComp,"u_blur"),1);' +
    '    _gl=gl;_progPrep=pPrep;_progBlur=pBlur;_progComp=pComp;_vbo=vbo;_tex=tex;' +
    '    _locs={' +
    '      prepStep:gl.getUniformLocation(pPrep,"u_step"),' +
    '      prepSun:gl.getUniformLocation(pPrep,"u_sunDir"),' +
    '      blurDir:gl.getUniformLocation(pBlur,"u_dir"),' +
    '      compSrc:gl.getUniformLocation(pComp,"u_srcSize"),' +
    '      compDst:gl.getUniformLocation(pComp,"u_dstSize"),' +
    '      compBlurStep:gl.getUniformLocation(pComp,"u_blurStep"),' +
    '      compCool:gl.getUniformLocation(pComp,"u_coolTint"),' +
    '      compHi:gl.getUniformLocation(pComp,"u_hiTint"),' +
    '      compTone:gl.getUniformLocation(pComp,"u_toneParams")' +
    '    };' +
    '    return true;' +
    '  };' +
    '  var _renderFrame=function(){' +
    '    if(!window._hdr3dEnabled||_destroyed||_ctxLost)return;' +
    '    var src=_findSrc();' +
    '    if(!src||!src.width||!src.height){if(_overlay)_overlay.style.display="none";return;}' +
    '    var rect=src.getBoundingClientRect();' +
    '    if(!rect||rect.width<2||rect.height<2){if(_overlay)_overlay.style.display="none";return;}' +
    '    if(!_initGl()){if(_overlay)_overlay.style.display="none";return;}' +
    '    var dpr=Math.min(window.devicePixelRatio||1,2);' +
    '    var l=Math.round(rect.left*10)/10,t=Math.round(rect.top*10)/10;' +
    '    var w=Math.round(rect.width*10)/10,h=Math.round(rect.height*10)/10;' +
    '    var bw=Math.max(1,Math.round(rect.width*dpr)),bh=Math.max(1,Math.round(rect.height*dpr));' +
    '    if(l!==_lastL){_overlay.style.left=l+"px";_lastL=l;}' +
    '    if(t!==_lastT){_overlay.style.top=t+"px";_lastT=t;}' +
    '    if(w!==_lastW){_overlay.style.width=w+"px";_lastW=w;}' +
    '    if(h!==_lastH){_overlay.style.height=h+"px";_lastH=h;}' +
    '    if(bw!==_lastBW){_overlay.width=bw;_lastBW=bw;}' +
    '    if(bh!==_lastBH){_overlay.height=bh;_lastBH=bh;}' +
    '    if(_overlay.style.display!=="block")_overlay.style.display="block";' +
    '    var fw=Math.max(128,Math.min(360,Math.round(bw*0.5)));' +
    '    var fh=Math.max(96,Math.min(270,Math.round(bh*0.5)));' +
    '    if(!_ensureFbos(_gl,fw,fh))return;' +
    '    try{' +
    '      _gl.activeTexture(_gl.TEXTURE0);' +
    '      _gl.bindTexture(_gl.TEXTURE_2D,_tex);' +
    '      _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL,true);' +
    '      if(src.width!==_texW||src.height!==_texH){' +
    '        _gl.texImage2D(_gl.TEXTURE_2D,0,_gl.RGBA,_gl.RGBA,_gl.UNSIGNED_BYTE,src);' +
    '        _texW=src.width;_texH=src.height;' +
    '      }else{' +
    '        _gl.texSubImage2D(_gl.TEXTURE_2D,0,0,0,_gl.RGBA,_gl.UNSIGNED_BYTE,src);' +
    '      }' +
    '      var gameW=Math.max(160,Math.min(_texW,280)),gameH=Math.max(120,Math.min(_texH,220));' +
    '      _probeRtcSupport();' +
    '      _updateLight(performance.now());' +
    '      var ls=_lightState;' +
    '      _gl.bindFramebuffer(_gl.FRAMEBUFFER,_fboA);' +
    '      _gl.viewport(0,0,fw,fh);' +
    '      _gl.useProgram(_progPrep);' +
    '      _gl.uniform2f(_locs.prepStep,1.0/gameW,1.0/gameH);' +
    '      _gl.uniform2f(_locs.prepSun,ls.sx,ls.sy);' +
    '      _gl.drawArrays(_gl.TRIANGLE_STRIP,0,4);' +
    '      _gl.bindFramebuffer(_gl.FRAMEBUFFER,_fboB);' +
    '      _gl.bindTexture(_gl.TEXTURE_2D,_texA);' +
    '      _gl.useProgram(_progBlur);' +
    '      _gl.uniform2f(_locs.blurDir,1.0/fw,0.0);' +
    '      _gl.drawArrays(_gl.TRIANGLE_STRIP,0,4);' +
    '      _gl.bindFramebuffer(_gl.FRAMEBUFFER,_fboA);' +
    '      _gl.bindTexture(_gl.TEXTURE_2D,_texB);' +
    '      _gl.uniform2f(_locs.blurDir,0.0,1.0/fh);' +
    '      _gl.drawArrays(_gl.TRIANGLE_STRIP,0,4);' +
    '      _gl.bindFramebuffer(_gl.FRAMEBUFFER,null);' +
    '      _gl.viewport(0,0,bw,bh);' +
    '      _gl.activeTexture(_gl.TEXTURE0);_gl.bindTexture(_gl.TEXTURE_2D,_tex);' +
    '      _gl.activeTexture(_gl.TEXTURE1);_gl.bindTexture(_gl.TEXTURE_2D,_texA);' +
    '      _gl.useProgram(_progComp);' +
    '      _gl.uniform2f(_locs.compSrc,_texW,_texH);' +
    '      _gl.uniform2f(_locs.compDst,bw,bh);' +
    '      _gl.uniform2f(_locs.compBlurStep,2.5/fw,2.5/fh);' +
    '      _gl.uniform3f(_locs.compCool,ls.cool[0],ls.cool[1],ls.cool[2]);' +
    '      _gl.uniform3f(_locs.compHi,ls.hi[0],ls.hi[1],ls.hi[2]);' +
    '      _gl.uniform3f(_locs.compTone,ls.exp,ls.bloom,ls.sh);' +
    '      _gl.drawArrays(_gl.TRIANGLE_STRIP,0,4);' +
    '      _gl.activeTexture(_gl.TEXTURE0);' +
    '    }catch(e){}' +
    '  };' +
    '  var _loop=function(){' +
    '    if(!window._hdr3dEnabled||_destroyed){_rafId=0;return;}' +
    '    _renderFrame();' +
    '    _rafId=requestAnimationFrame(_loop);' +
    '  };' +
    '  window.setHdr3dShader=function(active){' +
    '    var on=!!active;' +
    '    window._hdr3dEnabled=on;' +
    '    if(_destroyed)return;' +
    '    if(!on){' +
    '      if(_rafId){cancelAnimationFrame(_rafId);_rafId=0;}' +
    '      if(_overlay)_overlay.style.display="none";' +
    '      return;' +
    '    }' +
    '    _renderFrame();' +
    '    if(!_rafId)_rafId=requestAnimationFrame(_loop);' +
    '  };' +
    '  window._destroyHdr3dShader=function(){' +
    '    _destroyed=true;window._hdr3dEnabled=false;' +
    '    if(_rafId){cancelAnimationFrame(_rafId);_rafId=0;}' +
    '    if(_gl){' +
    '      try{if(_fboA)_gl.deleteFramebuffer(_fboA);}catch(e){}' +
    '      try{if(_texA)_gl.deleteTexture(_texA);}catch(e){}' +
    '      try{if(_fboB)_gl.deleteFramebuffer(_fboB);}catch(e){}' +
    '      try{if(_texB)_gl.deleteTexture(_texB);}catch(e){}' +
    '      try{if(_tex)_gl.deleteTexture(_tex);}catch(e){}' +
    '      try{if(_vbo)_gl.deleteBuffer(_vbo);}catch(e){}' +
    '      try{if(_progPrep)_gl.deleteProgram(_progPrep);}catch(e){}' +
    '      try{if(_progBlur)_gl.deleteProgram(_progBlur);}catch(e){}' +
    '      try{if(_progComp)_gl.deleteProgram(_progComp);}catch(e){}' +
    '      try{var ext=_gl.getExtension("WEBGL_lose_context");if(ext)ext.loseContext();}catch(e){}' +
    '    }' +
    '    _resetGlRefs();' +
    '    if(_overlay&&_overlay.parentNode)_overlay.parentNode.removeChild(_overlay);' +
    '    _overlay=null;' +
    '  };' +
    '  if(window._hdr3dEnabled)window.setHdr3dShader(true);' +
    '})();' +
    'var _vgpCleanCount=0;' +
    'window._vgpCleanIv=setInterval(function(){' +
    '  _vgpCleanCount++;' +
    '  try{' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '    if(window.EJS_emulator&&window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.style.display="none";' +
    '  }catch(e){}' +
    '  if(_vgpCleanCount>20)clearInterval(window._vgpCleanIv);' +
    '},500);' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
