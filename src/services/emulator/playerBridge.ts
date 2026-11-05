// ============================================================================
// EMULATORJS IFRAME PLAYER HTML BUILDER
// ============================================================================
export function buildPlayerHtml(core: string, romUrl: string, title?: string): string {
  const close = '<' + '/script>';
  const isNds = core === 'nds' || core === 'melonds' || core === 'desmume';
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
    'var _isNds=' + (isNds ? 'true' : 'false') + ';' +
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
    '    if(!_isNds && (t==="webgl"||t==="experimental-webgl"||t==="webgl2")){' +
    '      a=Object.assign({},a||{},{preserveDrawingBuffer:true});' +
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
    '          if(_isNds){' +
    '            p.settings.rewindEnabled="disabled";' +
    '            p.settings["rewind-granularity"]="0";' +
    '            p.settings["melonds_touch_mode"]="Touch";' +
    '            p.settings["melonds_threaded_renderer"]="enabled";' +
    '            p.settings["melonds_audio_interpolation"]="none";' +
    '          }else{' +
    '            p.settings.rewindEnabled="enabled";' +
    '            p.settings["rewind-granularity"]="3";' +
    '          }' +
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
    '          if(_isNds){' +
    '            cfg+="\\nrewind_enable = false\\n" +' +
    '                 "video_threaded = true\\n" +' +
    '                 "video_vsync = true\\n" +' +
    '                 "video_hard_sync = false\\n" +' +
    '                 "video_frame_delay = 0\\n" +' +
    '                 "audio_latency = 96\\n" +' +
    '                 "audio_sync = true\\n" +' +
    '                 "audio_rate_control = true\\n" +' +
    '                 "melonds_touch_mode = \\\"Touch\\\"\\n" +' +
    '                 "melonds_threaded_renderer = \\\"enabled\\\"\\n" +' +
    '                 "melonds_audio_interpolation = \\\"none\\\"\\n";' +
    '          }else{' +
    '            if(cfg.indexOf("rewind_enable")===-1){' +
    '              cfg+="\\nrewind_enable = true\\nrewind_granularity = 3\\nrewind_buffer_size = 20971520\\n";' +
    '            }' +
    '          }' +
    '          return cfg;' +
    '        };' +
    '      }' +
    '      var origPreload=OrigGM.prototype.setupPreLoadSettings;' +
    '      OrigGM.prototype.setupPreLoadSettings=function(){' +
    '        try{' +
    '          if(this.Module&&this.Module.callbacks){' +
    '            var origSetup=this.Module.callbacks.setupCoreSettingFile;' +
    '            this.Module.callbacks.setupCoreSettingFile=function(filePath){' +
    '              if(typeof origSetup==="function")origSetup(filePath);' +
    '              try{' +
    '                var cur="";' +
    '                try{cur=this.FS.readFile(filePath,{encoding:"utf8"})||"";}catch(e){}' +
    '                if(cur.indexOf("melonds_touch_mode")===-1){' +
    '                  this.writeFile(filePath,cur+\'\\nmelonds_touch_mode = "Touch"\\n\');' +
    '                }' +
    '              }catch(e){}' +
    '            }.bind(this);' +
    '          }' +
    '        }catch(e){}' +
    '        if(typeof origPreload==="function")origPreload.call(this);' +
    '      };' +
    '      var origWrite=OrigGM.prototype.writeConfigFile;' +
    '      OrigGM.prototype.writeConfigFile=function(){' +
    '        if(typeof origWrite==="function")origWrite.call(this);' +
    '        try{' +
    '          var fs=this.FS||(this.Module&&this.Module.FS);' +
    '          if(fs){' +
    '            var optStr=_isNds' +
    '              ? \'melonds_touch_mode = "Touch"\\nmelonds_threaded_renderer = "enabled"\\nmelonds_audio_interpolation = "none"\\n\'' +
    '              : \'melonds_touch_mode = "Touch"\\n\';' +
    '            try{fs.mkdir("/home/web_user/.config");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/.config/retroarch");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config/melonDS");}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/.config/retroarch/retroarch-core-options.cfg",optStr);}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/retroarch/userdata/config/melonDS/melonDS.opt",optStr);}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/retroarch/userdata/config/melonDS/melonDS.cfg",optStr);}catch(e){}' +
    '          }' +
    '        }catch(e){}' +
    '      };' +
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
    '      val.rewindEnabled=!_isNds;' +
    '      if(val.config){' +
    '        val.config.rewindEnabled=_isNds?"disabled":"enabled";' +
    '        if(!val.config.defaultOptions)val.config.defaultOptions={};' +
    '        val.config.defaultOptions.rewindEnabled=_isNds?"disabled":"enabled";' +
    '        val.config.defaultOptions["rewind-granularity"]=_isNds?"0":"3";' +
    '        if(_isNds){' +
    '          val.config.defaultOptions["melonds_touch_mode"]="Touch";' +
    '          val.config.defaultOptions["settings.melonds_touch_mode"]="Touch";' +
    '          val.config.defaultOptions["melonds_threaded_renderer"]="enabled";' +
    '          val.config.defaultOptions["settings.melonds_threaded_renderer"]="enabled";' +
    '          val.config.defaultOptions["melonds_audio_interpolation"]="none";' +
    '          val.config.defaultOptions["settings.melonds_audio_interpolation"]="none";' +
    '        }' +
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
    'window.EJS_fixedSaveInterval=' + (isNds ? '30000' : '10000') + ';' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_rewindEnabled=' + (isNds ? 'false' : 'true') + ';' +
    'window.EJS_defaultOptions=' + (isNds
      ? '{"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"disabled","settings.rewindEnabled":"disabled","rewind-granularity":"0","melonds_touch_mode":"Touch","settings.melonds_touch_mode":"Touch","melonds_threaded_renderer":"enabled","settings.melonds_threaded_renderer":"enabled","melonds_audio_interpolation":"none","settings.melonds_audio_interpolation":"none"};'
      : '{"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"enabled","settings.rewindEnabled":"enabled","rewind-granularity":"3"};') +
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
    'var _ffActive=false;' +
    'var _ffRatio=2;' +
    'var _ffTimer=null;' +
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
    '    window._rewindSnapshots=[];' +
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
    '      parent.postMessage({type:"ejs-srm-update",save:srm instanceof Uint8Array?srm:new Uint8Array(srm)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '},3000);' +
    'window.EJS_onSaveUpdate=function(e){' +
    '  try{' +
    '    if(window._userInteracted&&e&&e.save){' +
    '      parent.postMessage({type:"ejs-srm-update",save:e.save instanceof Uint8Array?e.save:new Uint8Array(e.save)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.EJS_onGameStart=function(){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(window.EJS_emulator.canvas&&!window.EJS_emulator.canvas.id)window.EJS_emulator.canvas.id="canvas";' +
    '      if(window.EJS_emulator.gameManager&&typeof window.EJS_emulator.gameManager.setVariable==="function"){' +
    '        window.EJS_emulator.gameManager.setVariable("melonds_touch_mode","Touch");' +
    '      }' +
    '      if(typeof window.EJS_emulator.toggleVirtualGamepad==="function")window.EJS_emulator.toggleVirtualGamepad(false);' +
    '      if(window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.remove();' +
    '    }' +
    '    var c=document.querySelector("canvas");if(c&&!c.id)c.id="canvas";' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");if(el)el.remove();' +
    '  }catch(e){}' +
    '  parent.postMessage({type:"ejs-ready"},"*");' +
    '};' +
    'window._userMuted=false;' +
    'window._resumeAudioContexts=function(){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu&&emu.Module){' +
    '      var al=emu.Module.AL;' +
    '      if(al&&al.currentCtx){' +
    '        if(al.currentCtx.audioCtx&&al.currentCtx.audioCtx.state==="suspended"){' +
    '          al.currentCtx.audioCtx.resume().catch(function(){});' +
    '        }' +
    '        if(al.currentCtx.sources){' +
    '          al.currentCtx.sources.forEach(function(s){' +
    '            if(s&&s.gain&&s.gain.context&&s.gain.context.state==="suspended"){' +
    '              s.gain.context.resume().catch(function(){});' +
    '            }' +
    '          });' +
    '        }' +
    '      }' +
    '      if(emu.Module.SDL2&&emu.Module.SDL2.audioContext&&emu.Module.SDL2.audioContext.state==="suspended"){' +
    '        emu.Module.SDL2.audioContext.resume().catch(function(){});' +
    '      }' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window._applyAudioVolume=function(vol){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(emu){' +
    '      if(typeof emu.setVolume==="function")emu.setVolume(vol);' +
    '      if(emu.gameManager&&typeof emu.gameManager.setVolume==="function")emu.gameManager.setVolume(vol);' +
    '      if(emu.Module&&emu.Module.AL&&emu.Module.AL.currentCtx&&emu.Module.AL.currentCtx.sources){' +
    '        emu.Module.AL.currentCtx.sources.forEach(function(s){' +
    '          if(s&&s.gain&&s.gain.gain)s.gain.gain.value=vol;' +
    '        });' +
    '      }' +
    '    }' +
    '  }catch(e){}' +
    '  try{' +
    '    var audios=document.querySelectorAll("audio,video");' +
    '    for(var i=0;i<audios.length;i++){audios[i].muted=(vol===0);}' +
    '  }catch(e){}' +
    '};' +
    'window.setAudioMuted=function(m){' +
    '  window._userMuted=!!m;' +
    '  if(!window._userMuted)window._resumeAudioContexts();' +
    '  window._applyAudioVolume(window._userMuted?0:1);' +
    '};' +
    'window.setPaused=function(p){' +
    '  try{' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu)return;' +
    '    if(p){' +
    '      if(typeof emu.pause==="function"){emu.pause();}' +
    '      else if(emu.gameManager&&typeof emu.gameManager.toggleMainLoop==="function"){emu.gameManager.toggleMainLoop(0);}' +
    '      window._applyAudioVolume(0);' +
    '    }else{' +
    '      if(typeof emu.play==="function"){emu.play();}' +
    '      else if(emu.gameManager&&typeof emu.gameManager.toggleMainLoop==="function"){emu.gameManager.toggleMainLoop(1);}' +
    '      window._resumeAudioContexts();' +
    '      window._applyAudioVolume(window._userMuted?0:1);' +
    '    }' +
    '  }catch(e){console.warn("setPaused err",e);}' +
    '};' +
    'window._rewindSnapshots=[];' +
    'window._isRewinding=false;' +
    'window._rewindTimer=null;' +
    'if(!_isNds){' +
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
    '}' +
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
    '      var startFrame=-1;' +
    '      try{' +
    '        if(gm&&gm.functions&&typeof gm.functions.getFrameNum==="function")startFrame=gm.functions.getFrameNum();' +
    '        else if(gm&&typeof gm.getFrameNum==="function")startFrame=gm.getFrameNum();' +
    '      }catch(e){}' +
    '      var checkCount=0,nativeActive=false;' +
    '      var stepRewind=function(){' +
    '        if(!window._isRewinding)return;' +
    '        if(gm){' +
    '          if(!nativeActive&&startFrame>0&&checkCount<3){' +
    '            checkCount++;' +
    '            try{' +
    '              var cur=(gm.functions&&typeof gm.functions.getFrameNum==="function")?gm.functions.getFrameNum():(typeof gm.getFrameNum==="function"?gm.getFrameNum():-1);' +
    '              if(cur>0&&cur<startFrame)nativeActive=true;' +
    '            }catch(e){}' +
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
    '      window._rewindTimer=setInterval(stepRewind,65);' +
    '      setTimeout(stepRewind,20);' +
    '    }else{' +
    '      if(window._rewindTimer){clearInterval(window._rewindTimer);window._rewindTimer=null;}' +
    '      if(gm){' +
    '        try{' +
    '          if(typeof gm.simulateInput==="function")gm.simulateInput(0,28,0);' +
    '          if(gm.functions&&typeof gm.functions.toggleRewind==="function")gm.functions.toggleRewind(0);' +
    '        }catch(e){}' +
    '      }' +
    '      if(!window._userMuted)window._resumeAudioContexts();' +
    '      window._applyAudioVolume(window._userMuted?0:1);' +
    '    }' +
    '  }catch(e){console.warn("setRewind err",e);}' +
    '};' +
    'window.addEventListener("message",function(e){' +
    '  if(e&&e.data&&e.data.type==="ejs-set-rewind"){' +
    '    window.setRewind(e.data.active);' +
    '  }' +
    '});' +
    'setInterval(function(){' +
    '  try{' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '    if(window.EJS_emulator&&window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.style.display="none";' +
    '  }catch(e){}' +
    '},250);' +
    'document.addEventListener("touchstart",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' +
    'document.addEventListener("touchmove",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
