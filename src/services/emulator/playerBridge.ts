// ============================================================================
// EMULATORJS IFRAME PLAYER HTML BUILDER
// Direct WebGL2 Swapchain + 16-Bit Input Bitmask Register + Audio Optimization
// ============================================================================
export function buildPlayerHtml(core: string, romUrl: string, title?: string): string {
  const close = '<' + '/script>';
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
    '#game{width:100%;height:100%;contain:strict}' +
    'canvas{image-rendering:pixelated;touch-action:none;will-change:contents}' +
    '.ejs_virtualGamepad_parent,.ejs_virtualGamepad_parent *,' +
    '.ejs_virtualGamepad_top,.ejs_virtualGamepad_bottom,.ejs_virtualGamepad_left,.ejs_virtualGamepad_right,' +
    '.ejs_dpad_main,.ejs_dpad_vertical,.ejs_dpad_horizontal,' +
    '.ejs_virtual_gamepad,.ejs_menu_bar,.ejs_context_menu,#ejs_menu_bar,' +
    'div[class*="virtualGamepad"],div[class*="dpad"],div[class*="gamepad"],div[class*="touch"]{' +
    'display:none!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important}' +
    '</style></head><body>' +
    '<div id="game"></div><script>' +
    'var _canThread=(typeof window.SharedArrayBuffer==="function"&&window.crossOriginIsolated===true);' +
    '(function(){' +
    '  var OrigAC=window.AudioContext||window.webkitAudioContext;' +
    '  if(OrigAC){' +
    '    var PatchedAC=function(opts){' +
    '      var o=Object.assign({latencyHint:"interactive"},opts||{});' +
    '      return new OrigAC(o);' +
    '    };' +
    '    PatchedAC.prototype=OrigAC.prototype;' +
    '    try{Object.setPrototypeOf(PatchedAC,OrigAC);}catch(e){}' +
    '    window.AudioContext=PatchedAC;' +
    '    if(window.webkitAudioContext)window.webkitAudioContext=PatchedAC;' +
    '  }' +
    '})();' +
    '(function(){' +
    '  var _ce=document.createElement.bind(document);' +
    '  document.createElement=function(t,o){' +
    '    var el=_ce(t,o);' +
    '    if(t&&typeof t==="string"&&t.toLowerCase()==="canvas"&&!el.id)el.id="canvas";' +
    '    return el;' +
    '  };' +
    '})();' +
    '(function(){' +
    '  var _ogc=HTMLCanvasElement.prototype.getContext;' +
    '  HTMLCanvasElement.prototype.getContext=function(t,a){' +
    '    if(t==="webgl"||t==="experimental-webgl"||t==="webgl2"){' +
    '      a=Object.assign({},a||{},{alpha:false,depth:false,stencil:false,antialias:false,powerPreference:"high-performance",preserveDrawingBuffer:true});' +
    '    }' +
    '    return _ogc.call(this,t,a);' +
    '  };' +
    '})();' +
    '(function(){' +
    '  try{' +
    '    var _og=Storage.prototype.getItem;' +
    '    Storage.prototype.getItem=function(k){' +
    '      var val=_og.call(this,k);' +
    '      if(typeof k==="string"&&(k.indexOf("ejs-")===0||k.indexOf("settings")!==-1)){' +
    '        try{' +
    '          var p=val?JSON.parse(val):{};' +
    '          if(!p||typeof p!=="object")p={};' +
    '          if(!p.settings||typeof p.settings!=="object")p.settings={};' +
    '          p.settings.webgl2Enabled="enabled";' +
    '          p.settings.ejs_threads=_canThread?"enabled":"disabled";' +
    '          p.settings.rewindEnabled="enabled";' +
    '          p.settings["rewind-granularity"]="3";' +
    '          return JSON.stringify(p);' +
    '        }catch(e){return val;}' +
    '      }' +
    '      return val;' +
    '    };' +
    '  }catch(e){}' +
    '})();' +
    'var _realGM=undefined;' +
    'Object.defineProperty(window,"EJS_GameManager",{' +
    '  get:function(){return _realGM;},' +
    '  set:function(OrigGM){' +
    '    _realGM=OrigGM;' +
    '    if(OrigGM&&OrigGM.prototype){' +
    '      var origCfg=OrigGM.prototype.getRetroArchCfg;' +
    '      if(typeof origCfg==="function"){' +
    '        OrigGM.prototype.getRetroArchCfg=function(){' +
    '          var cfg=origCfg.call(this)||"";' +
    '          if(cfg.indexOf("rewind_enable")===-1){' +
    '            cfg+="\\nrewind_enable = true\\nrewind_granularity = 3\\nrewind_buffer_size = 20971520\\n";' +
    '          }' +
    '          return cfg;' +
    '        };' +
    '      }' +
    '    }' +
    '  },' +
    '  configurable:true' +
    '});' +
    'var _realEmu=undefined;' +
    'Object.defineProperty(window,"EJS_emulator",{' +
    '  get:function(){return _realEmu;},' +
    '  set:function(val){' +
    '    _realEmu=val;' +
    '    if(val){' +
    '      if(val.canvas&&!val.canvas.id)val.canvas.id="canvas";' +
    '      val.webgl2Enabled=true;' +
    '      val.rewindEnabled=true;' +
    '      if(val.config){' +
    '        val.config.threads=_canThread;' +
    '        val.config.rewindEnabled="enabled";' +
    '        if(!val.config.defaultOptions)val.config.defaultOptions={};' +
    '        val.config.defaultOptions.webgl2Enabled="enabled";' +
    '        val.config.defaultOptions.ejs_threads=_canThread?"enabled":"disabled";' +
    '        val.config.defaultOptions.rewindEnabled="enabled";' +
    '        val.config.defaultOptions["rewind-granularity"]="3";' +
    '      }' +
    '    }' +
    '  },' +
    '  configurable:true' +
    '});' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(core) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_threads=_canThread;' +
    'window.EJS_fixedSaveInterval=15000;' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_rewindEnabled=true;' +
    'window.EJS_defaultOptions={"webgl2Enabled":"enabled","virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"enabled","settings.rewindEnabled":"enabled","rewind-granularity":"3"};' +
    'window.EJS_defaultOptions.ejs_threads=_canThread?"enabled":"disabled";' +
    'var _padMask=0;' +
    'var _bitPressTimes=new Float64Array(16);' +
    'var _bitReleaseTimers={};' +
    'var _bitToKey=[["z",90],["a",65],["ShiftRight",16],["Enter",13],["ArrowUp",38],["ArrowDown",40],["ArrowLeft",37],["ArrowRight",39],["x",88],["s",83],["q",81],["w",87]];' +
    'var _nameToBit={actionb:0,b:0,actiony:1,y:1,select:2,start:3,up:4,down:5,left:6,right:7,actiona:8,a:8,actionx:9,x:9,btnl:10,l:10,btnr:11,r:11};' +
    'var _dispatchKbBit=function(bit,down){' +
    '  var k=_bitToKey[bit];' +
    '  if(!k)return;' +
    '  try{' +
    '    var ev=new KeyboardEvent(down?"keydown":"keyup",{key:k[0],code:k[0],bubbles:true,cancelable:true});' +
    '    Object.defineProperty(ev,"keyCode",{get:function(){return k[1];}});' +
    '    Object.defineProperty(ev,"which",{get:function(){return k[1];}});' +
    '    var target=document.getElementById("game")||document.querySelector("canvas")||window;' +
    '    target.dispatchEvent(ev);' +
    '  }catch(e){}' +
    '};' +
    'var _writeHardwareBit=function(bit,pressed){' +
    '  var emu=window.EJS_emulator;' +
    '  var gm=emu&&emu.gameManager;' +
    '  if(gm){' +
    '    var rawFn=(gm.Module&&gm.Module._simulate_input)||(gm.functions&&gm.functions.simulateInput);' +
    '    if(typeof rawFn==="function"){try{rawFn(0,bit,pressed?1:0);}catch(e){}}' +
    '    if(typeof gm.simulateInput==="function"){try{gm.simulateInput(0,bit,pressed?1:0);}catch(e){}}' +
    '  }' +
    '  _dispatchKbBit(bit,pressed);' +
    '};' +
    'window.setInputBitmask=function(nextMask){' +
    '  nextMask=(nextMask|0)&0x0FFF;' +
    '  var diff=nextMask^_padMask;' +
    '  if(!diff)return;' +
    '  var now=performance.now();' +
    '  for(var b=0;b<12;b++){' +
    '    var bitFlag=1<<b;' +
    '    if(diff&bitFlag){' +
    '      if(nextMask&bitFlag){' +
    '        if(_bitReleaseTimers[b]){clearTimeout(_bitReleaseTimers[b]);delete _bitReleaseTimers[b];}' +
    '        _bitPressTimes[b]=now;' +
    '        _padMask|=bitFlag;' +
    '        _writeHardwareBit(b,true);' +
    '      }else{' +
    '        var elapsed=now-_bitPressTimes[b];' +
    '        var minHold=75;' +
    '        if(elapsed<minHold){' +
    '          (function(bit,delay){' +
    '            _bitReleaseTimers[bit]=setTimeout(function(){' +
    '              delete _bitReleaseTimers[bit];' +
    '              if(!((window._pendingPadMask||0)&(1<<bit))){' +
    '                _padMask&=~(1<<bit);' +
    '                _writeHardwareBit(bit,false);' +
    '              }' +
    '            },delay);' +
    '          })(b,Math.max(1,Math.round(minHold-elapsed)));' +
    '        }else{' +
    '          _padMask&=~bitFlag;' +
    '          _writeHardwareBit(b,false);' +
    '        }' +
    '      }' +
    '    }' +
    '  }' +
    '  window._pendingPadMask=nextMask;' +
    '};' +
    'window.setButtonBit=function(bit,pressed){' +
    '  bit=Number(bit);' +
    '  if(isNaN(bit)||bit<0||bit>15)return;' +
    '  var current=window._pendingPadMask!=null?window._pendingPadMask:_padMask;' +
    '  var next=pressed?(current|(1<<bit)):(current&~(1<<bit));' +
    '  window.setInputBitmask(next);' +
    '};' +
    'window.simulateButton=function(name,down){' +
    '  var k=String(name).toLowerCase();' +
    '  var bit=_nameToBit[k];' +
    '  if(typeof bit!=="undefined"){' +
    '    window.setButtonBit(bit,!!down);' +
    '  }' +
    '};' +
    'window.simulateKey=window.simulateButton;' +
    'window.setDpadMask=function(dpadMask){' +
    '  var current=window._pendingPadMask!=null?window._pendingPadMask:_padMask;' +
    '  var dpadBits=(dpadMask&0xF0);' +
    '  var next=(current&~0xF0)|dpadBits;' +
    '  window.setInputBitmask(next);' +
    '};' +
    'var _ffActive=false;' +
    'var _ffRatio=2;' +
    'var _applyFf=function(){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    var gm=emu.gameManager;' +
    '    var r=typeof _ffRatio==="number"&&_ffRatio>=1?_ffRatio:2;' +
    '    if(!_ffActive){' +
    '      emu.isFastForward=false;' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        emu.handleSpecialOptions("fastForward","disabled");' +
    '      }' +
    '      if(gm&&typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(1);' +
    '      if(gm&&typeof gm.toggleFastForward==="function")gm.toggleFastForward(0);' +
    '      if(gm&&typeof gm.setFastForward==="function")gm.setFastForward(false);' +
    '    }else{' +
    '      emu.isFastForward=true;' +
    '      if(typeof emu.handleSpecialOptions==="function"){' +
    '        emu.handleSpecialOptions("ff-ratio",String(r));' +
    '        emu.handleSpecialOptions("fastForward","enabled");' +
    '      }' +
    '      if(gm&&typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(r);' +
    '      if(gm&&typeof gm.toggleFastForward==="function")gm.toggleFastForward(1);' +
    '      if(gm&&typeof gm.setFastForward==="function")gm.setFastForward(true);' +
    '    }' +
    '  }catch(e){console.warn("ff error",e);}' +
    '};' +
    'window.setFastForward=function(active,ratio){' +
    '  _ffActive=!!active;' +
    '  if(typeof ratio==="number"&&ratio>=1)_ffRatio=ratio;' +
    '  _applyFf();' +
    '};' +
    'window.setFastForwardSpeed=function(ratio){' +
    '  var r=Number(ratio)||0;' +
    '  window.setFastForward(r>0,r);' +
    '};' +
    'window._toU8=function(data){' +
    '  if(!data)return null;' +
    '  if(data instanceof Uint8Array)return data;' +
    '  if(data instanceof ArrayBuffer)return new Uint8Array(data);' +
    '  if(ArrayBuffer.isView(data))return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);' +
    '  if(Array.isArray(data))return new Uint8Array(data);' +
    '  if(typeof data==="string"){' +
    '    var b64=data.replace(/^data:[^;]+;base64,/,"");' +
    '    try{' +
    '      var bin=atob(b64);' +
    '      var u=new Uint8Array(bin.length);' +
    '      for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);' +
    '      return u;' +
    '    }catch(e){}' +
    '  }' +
    '  return null;' +
    '};' +
    'window.loadSrmData=function(bytes){' +
    '  try{' +
    '    var arr=window._toU8(bytes);' +
    '    if(!arr||!arr.length)return false;' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.gameManager)return false;' +
    '    var gm=emu.gameManager;' +
    '    if(typeof gm.setSaveData==="function"){' +
    '      gm.setSaveData(arr);' +
    '      return true;' +
    '    }' +
    '    var fs=gm.FS||(gm.Module&&gm.Module.FS);' +
    '    if(fs&&typeof fs.writeFile==="function"){' +
    '      var paths=window._getSaveFilePaths();' +
    '      var ok=false;' +
    '      for(var i=0;i<paths.length;i++){' +
    '        try{fs.writeFile(paths[i],arr);ok=true;}catch(e){}' +
    '      }' +
    '      if(ok)return true;' +
    '    }' +
    '    if(typeof gm.loadSave==="function"){' +
    '      gm.loadSave(arr);' +
    '      return true;' +
    '    }' +
    '  }catch(e){console.error("loadSrmData err",e);}' +
    '  return false;' +
    '};' +
    'window._getSaveFilePaths=function(){' +
    '  var list=[];' +
    '  var emu=window.EJS_emulator;' +
    '  var p=emu&&emu.gamePath;' +
    '  if(!p&&window.EJS_gameUrl)p=window.EJS_gameUrl;' +
    '  if(!p)p="/game.srm";' +
    '  var base=p.replace(/\\.[^/.]+$/,"");' +
    '  var exts=[".srm",".sav"];' +
    '  for(var i=0;i<exts.length;i++)list.push(base+exts[i]);' +
    '  list.push("/game.srm");list.push("/game.sav");' +
    '  list.push("/home/web_user/retroarch/userdata/saves/game.srm");' +
    '  return list;' +
    '};' +
    'window.getSrmData=function(forceFlush){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.gameManager)return null;' +
    '    var gm=emu.gameManager;' +
    '    if(forceFlush&&typeof gm.functions!=="undefined"&&typeof gm.functions.saveSaveFiles==="function"){' +
    '      try{gm.functions.saveSaveFiles();}catch(e){}' +
    '    }' +
    '    if(typeof gm.getSaveData==="function"){' +
    '      var d=gm.getSaveData();' +
    '      if(d&&d.length)return new Uint8Array(d).slice();' +
    '    }' +
    '    var fs=gm.FS||(gm.Module&&gm.Module.FS);' +
    '    if(fs&&typeof fs.readFile==="function"){' +
    '      var paths=window._getSaveFilePaths();' +
    '      for(var i=0;i<paths.length;i++){' +
    '        try{' +
    '          var bytes=fs.readFile(paths[i]);' +
    '          if(bytes&&bytes.length)return new Uint8Array(bytes).slice();' +
    '        }catch(e){}' +
    '      }' +
    '    }' +
    '  }catch(e){console.error("getSrmData err",e);}' +
    '  return null;' +
    '};' +
    'window.loadStateData=function(bytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var arr=window._toU8(bytes);' +
    '    if(!arr||arr.length<16)return false;' +
    '    window._rewindSnapshots=[];' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    if(gm.FS&&gm.functions&&typeof gm.functions.loadState==="function"){' +
    '      try{gm.FS.unlink("game.state");}catch(e){}' +
    '      gm.FS.writeFile("/game.state",arr);' +
    '      if(typeof gm.clearEJSResetTimer==="function")gm.clearEJSResetTimer();' +
    '      var res=gm.functions.loadState("game.state",0);' +
    '      setTimeout(function(){try{gm.FS.unlink("game.state");}catch(e){}},3000);' +
    '      return res===1||res===0||res===true;' +
    '    }' +
    '    if(typeof gm.loadState==="function"){' +
    '      gm.loadState(arr);' +
    '      return true;' +
    '    }' +
    '    return false;' +
    '  }catch(e){console.error("loadStateData err",e);return false;}' +
    '};' +
    'window.getStateData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var st=window.EJS_emulator.gameManager.getState();' +
    '    return st?new Uint8Array(st).slice():null;' +
    '  }catch(e){return null;}' +
    '};' +
    'window.getFrameCount=function(){' +
    '  try{' +
    '    var gm=window.EJS_emulator&&window.EJS_emulator.gameManager;' +
    '    if(!gm)return -1;' +
    '    if(gm.Module&&typeof gm.Module._get_current_frame_count==="function")return gm.Module._get_current_frame_count();' +
    '    if(gm.functions&&typeof gm.functions.getFrameNum==="function")return gm.functions.getFrameNum();' +
    '    if(typeof gm.getFrameNum==="function")return gm.getFrameNum();' +
    '  }catch(e){}' +
    '  return -1;' +
    '};' +
    'window._measuredFps=60;' +
    'window.getMeasuredFps=function(){return window._measuredFps||60;};' +
    '(function(){' +
    '  var lastFrames=-1,lastTs=0;' +
    '  setInterval(function(){' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.started||emu.paused)return;' +
    '    var now=performance.now();' +
    '    var fc=window.getFrameCount();' +
    '    if(fc>=0){' +
    '      if(lastFrames>=0&&now>lastTs+100){' +
    '        var fps=Math.round(((fc-lastFrames)*1000)/(now-lastTs));' +
    '        if(fps>=0&&fps<=240)window._measuredFps=fps;' +
    '      }' +
    '      lastFrames=fc;lastTs=now;' +
    '    }' +
    '  },500);' +
    '})();' +
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
    'var _markInteracted=function(){' +
    '  if(!window._userInteracted){' +
    '    window._userInteracted=true;' +
    '    parent.postMessage({type:"ejs-user-input"},"*");' +
    '  }' +
    '};' +
    'window.addEventListener("keydown",_markInteracted,true);' +
    'window.addEventListener("pointerdown",_markInteracted,true);' +
    'window.addEventListener("touchstart",_markInteracted,true);' +
    'window.addEventListener("mousedown",_markInteracted,true);' +
    'setInterval(function(){' +
    '  try{' +
    '    if(!window._userInteracted)return;' +
    '    var srm=window.getSrmData&&window.getSrmData(false);' +
    '    if(!srm||!srm.length)return;' +
    '    var h=0,nonEmpty=false;' +
    '    for(var i=0;i<srm.length;i+=4){' +
    '      var b=srm[i];' +
    '      if(b!==0&&b!==255)nonEmpty=true;' +
    '      h=((h<<5)-h+b)|0;' +
    '    }' +
    '    if(nonEmpty&&h!==_lastSrmHash){' +
    '      _lastSrmHash=h;' +
    '      parent.postMessage({type:"ejs-srm-update",save:srm instanceof Uint8Array?srm:new Uint8Array(srm)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '},4000);' +
    'window.EJS_onSaveUpdate=function(e){' +
    '  try{' +
    '    if(window._userInteracted&&e&&e.save){' +
    '      parent.postMessage({type:"ejs-srm-update",save:e.save instanceof Uint8Array?e.save:new Uint8Array(e.save)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'var _cleanVirtualGamepad=function(){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(typeof window.EJS_emulator.toggleVirtualGamepad==="function")window.EJS_emulator.toggleVirtualGamepad(false);' +
    '      if(window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.remove();' +
    '    }' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '  }catch(e){}' +
    '};' +
    'window.EJS_onGameStart=function(){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(window.EJS_emulator.canvas&&!window.EJS_emulator.canvas.id)window.EJS_emulator.canvas.id="canvas";' +
    '    }' +
    '    var c=document.querySelector("canvas");if(c&&!c.id)c.id="canvas";' +
    '    _cleanVirtualGamepad();' +
    '    setTimeout(_cleanVirtualGamepad,300);' +
    '    setTimeout(_cleanVirtualGamepad,1200);' +
    '  }catch(e){}' +
    '  parent.postMessage({type:"ejs-ready",threaded:_canThread},"*");' +
    '};' +
    'window._userMuted=false;' +
    'window._resumeAudioContexts=function(){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&emu.Module){' +
    '      var al=emu.Module.AL;' +
    '      if(al&&al.currentCtx){' +
    '        var ctx=al.currentCtx.audioCtx;' +
    '        if(ctx&&ctx.state==="suspended"&&!window._userMuted){ctx.resume().catch(function(){});}' +
    '      }' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.addEventListener("pointerdown",window._resumeAudioContexts,true);' +
    'window.addEventListener("touchstart",window._resumeAudioContexts,true);' +
    'window._applyAudioVolume=function(vol){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&emu.gameManager&&typeof emu.gameManager.setVolume==="function")emu.gameManager.setVolume(vol);' +
    '    if(emu&&typeof emu.setVolume==="function")emu.setVolume(vol);' +
    '    if(emu&&emu.Module&&emu.Module.AL&&emu.Module.AL.currentCtx){' +
    '      var ctx=emu.Module.AL.currentCtx.audioCtx;' +
    '      if(ctx){' +
    '        if(vol===0&&ctx.state==="running")ctx.suspend().catch(function(){});' +
    '        else if(vol>0&&ctx.state==="suspended")ctx.resume().catch(function(){});' +
    '      }' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.setMuted=function(muted){' +
    '  window._userMuted=!!muted;' +
    '  window._applyAudioVolume(muted?0:1);' +
    '};' +
    'window.setPaused=function(paused){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    if(paused){' +
    '      if(typeof emu.pause==="function")emu.pause();' +
    '      else if(emu.gameManager&&typeof emu.gameManager.pauseGame==="function")emu.gameManager.pauseGame();' +
    '      window._applyAudioVolume(0);' +
    '    }else{' +
    '      if(typeof emu.play==="function")emu.play();' +
    '      else if(emu.gameManager&&typeof emu.gameManager.resumeGame==="function")emu.gameManager.resumeGame();' +
    '      if(!window._userMuted)window._applyAudioVolume(1);' +
    '    }' +
    '  }catch(e){console.warn("setPaused err",e);}' +
    '};' +
    'window._rewindSnapshots=[];' +
    'window._isRewinding=false;' +
    'window._rewindTimer=null;' +
    'setInterval(function(){' +
    '  if(window._isRewinding)return;' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.gameManager||!emu.started||emu.paused)return;' +
    '    var gm=emu.gameManager;' +
    '    if(typeof gm.getState!=="function")return;' +
    '    var st=gm.getState();' +
    '    if(st&&st.length>0){' +
    '      window._rewindSnapshots.push(new Uint8Array(st));' +
    '      if(window._rewindSnapshots.length>70)window._rewindSnapshots.shift();' +
    '    }' +
    '  }catch(e){}' +
    '},200);' +
    'window.setRewind=function(active){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    var gm=emu.gameManager;' +
    '    window._isRewinding=!!active;' +
    '    if(active){' +
    '      window._applyAudioVolume(0);' +
    '      if(gm){' +
    '        try{' +
    '          if(typeof gm.simulateInput==="function")gm.simulateInput(0,28,1);' +
    '          if(gm.functions&&typeof gm.functions.toggleRewind==="function")gm.functions.toggleRewind(1);' +
    '        }catch(e){}' +
    '      }' +
    '      if(window._rewindTimer){clearInterval(window._rewindTimer);window._rewindTimer=null;}' +
    '      var startFrame=window.getFrameCount();' +
    '      var checkCount=0,nativeActive=false;' +
    '      var stepRewind=function(){' +
    '        if(!window._isRewinding)return;' +
    '        if(gm){' +
    '          if(!nativeActive&&startFrame>0&&checkCount<3){' +
    '            checkCount++;' +
    '            var cur=window.getFrameCount();' +
    '            if(cur>0&&cur<startFrame)nativeActive=true;' +
    '          }' +
    '          if(!nativeActive&&window._rewindSnapshots&&window._rewindSnapshots.length>0){' +
    '            var prev=window._rewindSnapshots.pop();' +
    '            if(prev){' +
    '              try{' +
    '                if(gm.FS&&gm.functions&&typeof gm.functions.loadState==="function"){' +
    '                  gm.FS.writeFile("/game.state",prev);' +
    '                  gm.functions.loadState("game.state",0);' +
    '                }else if(typeof gm.loadState==="function"){' +
    '                  gm.loadState(prev);' +
    '                }' +
    '              }catch(e){}' +
    '            }' +
    '          }' +
    '        }' +
    '      };' +
    '      window._rewindTimer=setInterval(stepRewind,50);' +
    '      stepRewind();' +
    '    }else{' +
    '      if(window._rewindTimer){clearInterval(window._rewindTimer);window._rewindTimer=null;}' +
    '      if(gm){' +
    '        try{' +
    '          if(typeof gm.simulateInput==="function")gm.simulateInput(0,28,0);' +
    '          if(gm.functions&&typeof gm.functions.toggleRewind==="function")gm.functions.toggleRewind(0);' +
    '        }catch(e){}' +
    '      }' +
    '      if(!window._userMuted)window._applyAudioVolume(1);' +
    '    }' +
    '  }catch(e){console.warn("setRewind err",e);}' +
    '};' +
    'window.addEventListener("message",function(e){' +
    '  if(e&&e.data&&e.data.type==="ejs-set-rewind"){' +
    '    window.setRewind(e.data.active);' +
    '  }' +
    '});' +
    'document.addEventListener("touchstart",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' +
    'document.addEventListener("touchmove",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
