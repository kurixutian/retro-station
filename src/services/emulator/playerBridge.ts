// ============================================================================
// EMULATORJS IFRAME PLAYER HTML BUILDER
// Direct WebGL2 Swapchain + 16-Bit Input Bitmask Register + Dynamic Frameskip
// ============================================================================
export function buildPlayerHtml(core: string, romUrl: string, title?: string): string {
  const close = '<' + '/script>';
  const isNds = core === 'nds' || core === 'melonds' || core === 'desmume' || core === 'desmume2015';
  const effectiveCore = isNds ? 'desmume2015' : core;
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
    'var _isNds=' + (isNds ? 'true' : 'false') + ';' +
    'var _canThread=(typeof window.SharedArrayBuffer==="function"&&window.crossOriginIsolated===true&&!/[?&]nothread=1/.test(parent.location.search));' +
    'var _initFrameskip=_isNds?(_canThread?"0":"2"):"0";' +
    'var _curFrameskip=_isNds?(_canThread?0:2):0;' +
    'var _ndsCores=_canThread?"4":"1";' +
    'if(/[?&]debug=1/.test(parent.location.search)){(function(){var d=document.createElement("div");d.style.cssText="position:fixed;left:0;top:0;right:0;max-height:40%;overflow:hidden;z-index:99999;pointer-events:none;background:rgba(0,0,0,.75);color:#0f0;font:10px monospace;white-space:pre-wrap";var L=["threads="+_canThread+" isolated="+window.crossOriginIsolated];var r=function(){d.textContent=L.slice(-12).join("\\n")+"\\nfps="+(window._measuredFps||0)+" skip="+(typeof _curFrameskip!=="undefined"?_curFrameskip:"?")};var a=function(m){L.push(String(m).slice(0,160));r()};window.addEventListener("error",function(e){a("ERR "+e.message)});window.addEventListener("unhandledrejection",function(e){a("REJ "+(e.reason&&e.reason.message||e.reason))});var ce=console.error;console.error=function(){a("CE "+Array.prototype.join.call(arguments," "));ce.apply(console,arguments)};document.addEventListener("DOMContentLoaded",function(){document.body.appendChild(d);r()});setInterval(r,1000)})()}' +
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
    '      a=Object.assign({},a||{},{alpha:false,depth:false,stencil:false,antialias:false,powerPreference:"high-performance",desynchronized:_isNds,preserveDrawingBuffer:!_isNds});' +
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
    '          if(_isNds){' +
    '            p.settings.vsync="disabled";' +
    '            p.settings.rewindEnabled="disabled";' +
    '            p.settings["rewind-granularity"]="0";' +
    '            p.settings["retroarch_core"]="desmume2015";' +
    '            p.settings["desmume_frameskip"]=_initFrameskip;' +
    '            p.settings["desmume_cpu_mode"]="jit";' +
    '            p.settings["desmume_advanced_timing"]="disabled";' +
    '            p.settings["desmume_num_cores"]=_ndsCores;' +
    '            p.settings["desmume_internal_resolution"]="256x192";' +
    '            p.settings["desmume_pointer_type"]="touch";' +
    '            p.settings["desmume_pointer_mouse"]="enabled";' +
    '            p.settings["desmume_gfx_edgemark"]="disabled";' +
    '            p.settings["desmume_gfx_linehack"]="disabled";' +
    '            p.settings["desmume_gfx_txthack"]="disabled";' +
    '            p.settings["desmume_screens_layout"]="top/bottom";' +
    '            p.settings["desmume_screens_gap"]="0";' +
    '            p.settings["melonds_touch_mode"]="Touch";' +
    '            p.settings["melonds_threaded_renderer"]="enabled";' +
    '            p.settings["melonds_audio_interpolation"]="none";' +
    '            p.settings["melonds_audio_bitrate"]="10-bit";' +
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
    'var _buildNdsCoreOpts=function(){' +
    '  return \'desmume_frameskip = "\'+_initFrameskip+\'"\\n\' +' +
    '    \'desmume_cpu_mode = "jit"\\n\' +' +
    '    \'desmume_advanced_timing = "disabled"\\n\' +' +
    '    \'desmume_internal_resolution = "256x192"\\n\' +' +
    '    \'desmume_pointer_type = "touch"\\n\' +' +
    '    \'desmume_pointer_mouse = "enabled"\\n\' +' +
    '    \'desmume_gfx_edgemark = "disabled"\\n\' +' +
    '    \'desmume_gfx_linehack = "disabled"\\n\' +' +
    '    \'desmume_gfx_txthack = "disabled"\\n\' +' +
    '    \'desmume_screens_layout = "top/bottom"\\n\' +' +
    '    \'desmume_screens_gap = "0"\\n\' +' +
    '    \'desmume_num_cores = "\'+_ndsCores+\'"\\n\' +' +
    '    \'melonds_touch_mode = "Touch"\\n\' +' +
    '    \'melonds_threaded_renderer = "enabled"\\n\' +' +
    '    \'melonds_audio_interpolation = "none"\\n\' +' +
    '    \'melonds_audio_bitrate = "10-bit"\\n\';' +
    '};' +
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
    '            cfg=cfg.replace(/video_vsync\\s*=\\s*[^\\n]+/g,"video_vsync = false");' +
    '            cfg=cfg.replace(/audio_latency\\s*=\\s*[^\\n]+/g,"audio_latency = 128");' +
    '            cfg+="\\nrewind_enable = false\\n" +' +
    '                 "video_threaded = "+(_canThread?"true":"false")+"\\n" +' +
    '                 "video_vsync = false\\n" +' +
    '                 "video_hard_sync = false\\n" +' +
    '                 "video_frame_delay = 0\\n" +' +
    '                 "video_smooth = false\\n" +' +
    '                 "audio_latency = 128\\n" +' +
    '                 "audio_sync = false\\n" +' +
    '                 "audio_rate_control = false\\n" +' +
    '                 "audio_fastforward_mute = true\\n" +' +
    '                 _buildNdsCoreOpts();' +
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
    '                if(_isNds){' +
    '                  this.writeFile(filePath,cur+"\\n"+_buildNdsCoreOpts());' +
    '                }else if(cur.indexOf("melonds_touch_mode")===-1){' +
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
    '            var optStr=_isNds?_buildNdsCoreOpts():\'melonds_touch_mode = "Touch"\\n\';' +
    '            try{fs.mkdir("/home/web_user/.config");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/.config/retroarch");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config/melonDS");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config/DeSmuME");}catch(e){}' +
    '            try{fs.mkdir("/home/web_user/retroarch/userdata/config/DeSmuME 2015");}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/.config/retroarch/retroarch-core-options.cfg",optStr);}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/retroarch/userdata/config/melonDS/melonDS.opt",optStr);}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/retroarch/userdata/config/DeSmuME/DeSmuME.opt",optStr);}catch(e){}' +
    '            try{fs.writeFile("/home/web_user/retroarch/userdata/config/DeSmuME 2015/DeSmuME 2015.opt",optStr);}catch(e){}' +
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
    '      val.webgl2Enabled=true;' +
    '      val.rewindEnabled=!_isNds;' +
    '      if(val.config){' +
    '        val.config.threads=_canThread;' +
    '        val.config.rewindEnabled=_isNds?"disabled":"enabled";' +
    '        if(!val.config.defaultOptions)val.config.defaultOptions={};' +
    '        val.config.defaultOptions.webgl2Enabled="enabled";' +
    '        val.config.defaultOptions.ejs_threads=_canThread?"enabled":"disabled";' +
    '        val.config.defaultOptions.rewindEnabled=_isNds?"disabled":"enabled";' +
    '        val.config.defaultOptions["rewind-granularity"]=_isNds?"0":"3";' +
    '        if(_isNds){' +
    '          val.config.defaultOptions.vsync="disabled";' +
    '          val.config.defaultOptions["retroarch_core"]="desmume2015";' +
    '          val.config.defaultOptions["desmume_frameskip"]=_initFrameskip;' +
    '          val.config.defaultOptions["settings.desmume_frameskip"]=_initFrameskip;' +
    '          val.config.defaultOptions["desmume_cpu_mode"]="jit";' +
    '          val.config.defaultOptions["desmume_num_cores"]=_ndsCores;' +
    '          val.config.defaultOptions["desmume_advanced_timing"]="disabled";' +
    '          val.config.defaultOptions["settings.desmume_advanced_timing"]="disabled";' +
    '          val.config.defaultOptions["desmume_pointer_type"]="touch";' +
    '          val.config.defaultOptions["desmume_pointer_mouse"]="enabled";' +
    '          val.config.defaultOptions["desmume_gfx_edgemark"]="disabled";' +
    '          val.config.defaultOptions["desmume_gfx_linehack"]="disabled";' +
    '          val.config.defaultOptions["melonds_touch_mode"]="Touch";' +
    '          val.config.defaultOptions["settings.melonds_touch_mode"]="Touch";' +
    '          val.config.defaultOptions["melonds_threaded_renderer"]="enabled";' +
    '          val.config.defaultOptions["melonds_audio_interpolation"]="none";' +
    '          val.config.defaultOptions["settings.melonds_audio_interpolation"]="none";' +
    '        }' +
    '      }' +
    '    }' +
    '  },' +
    '  configurable:true' +
    '});' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(effectiveCore) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_threads=_canThread;' +
    'window.EJS_fixedSaveInterval=' + (isNds ? '45000' : '15000') + ';' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_rewindEnabled=' + (isNds ? 'false' : 'true') + ';' +
    'window.EJS_defaultOptions=' + (isNds
      ? '{"webgl2Enabled":"enabled","vsync":"disabled","virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"disabled","settings.rewindEnabled":"disabled","rewind-granularity":"0","retroarch_core":"desmume2015","desmume_cpu_mode":"jit","desmume_advanced_timing":"disabled","settings.desmume_advanced_timing":"disabled","desmume_pointer_type":"touch","desmume_pointer_mouse":"enabled","desmume_gfx_edgemark":"disabled","desmume_gfx_linehack":"disabled","melonds_touch_mode":"Touch","settings.melonds_touch_mode":"Touch","melonds_threaded_renderer":"enabled","melonds_audio_interpolation":"none","settings.melonds_audio_interpolation":"none"};'
      : '{"webgl2Enabled":"enabled","virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","ff-ratio":"2","rewindEnabled":"enabled","settings.rewindEnabled":"enabled","rewind-granularity":"3"};') +
    'window.EJS_defaultOptions.ejs_threads=_canThread?"enabled":"disabled";' +
    'if(_isNds){window.EJS_defaultOptions.desmume_frameskip=_initFrameskip;window.EJS_defaultOptions["settings.desmume_frameskip"]=_initFrameskip;window.EJS_defaultOptions.desmume_num_cores=_ndsCores;}' +
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
    '    if(typeof rawFn==="function"){try{rawFn(0,bit,pressed?1:0);return;}catch(e){}}' +
    '    if(typeof gm.simulateInput==="function"){try{gm.simulateInput(0,bit,pressed?1:0);return;}catch(e){}}' +
    '  }' +
    '  _dispatchKbBit(bit,pressed);' +
    '};' +
    'window.setInputBitmask=function(nextMask){' +
    '  nextMask=(nextMask|0)&0x0FFF;' +
    '  var diff=nextMask^_padMask;' +
    '  if(!diff)return;' +
    '  _padMask=nextMask;' +
    '  if(nextMask)_markInteracted();' +
    '  while(diff){' +
    '    var lsb=diff&-diff;' +
    '    var bit=31-Math.clz32(lsb);' +
    '    diff^=lsb;' +
    '    _writeHardwareBit(bit,(nextMask&lsb)!==0);' +
    '  }' +
    '};' +
    'window.setDpadMask=function(dpadBits){' +
    '  window.setInputBitmask((_padMask&~0x00F0)|(dpadBits&0x00F0));' +
    '};' +
    'window.setButtonBit=function(bit,down){' +
    '  bit=bit|0;' +
    '  if(bit<0||bit>11)return;' +
    '  var flag=1<<bit;' +
    '  var isDpad=(bit>=4&&bit<=7);' +
    '  if(down){' +
    '    if(_bitReleaseTimers[bit]){clearTimeout(_bitReleaseTimers[bit]);_bitReleaseTimers[bit]=0;}' +
    '    _bitPressTimes[bit]=performance.now();' +
    '    window.setInputBitmask(_padMask|flag);' +
    '  }else if(isDpad){' +
    '    window.setInputBitmask(_padMask&~flag);' +
    '  }else{' +
    '    var elapsed=performance.now()-_bitPressTimes[bit];' +
    '    if(elapsed<18){' +
    '      if(_bitReleaseTimers[bit])clearTimeout(_bitReleaseTimers[bit]);' +
    '      _bitReleaseTimers[bit]=setTimeout(function(){' +
    '        _bitReleaseTimers[bit]=0;' +
    '        window.setInputBitmask(_padMask&~flag);' +
    '      },18-elapsed);' +
    '    }else{' +
    '      window.setInputBitmask(_padMask&~flag);' +
    '    }' +
    '  }' +
    '};' +
    'window.simulateButton=function(name,down){' +
    '  var bit=_nameToBit[String(name).toLowerCase()];' +
    '  if(bit!==undefined)window.setButtonBit(bit,down);' +
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
    '    if(_isNds&&typeof gm.setVariable==="function"){' +
    '      try{gm.setVariable("desmume_frameskip",_ffActive?(r>=4?"4":"3"):String(_curFrameskip));}catch(e){}' +
    '    }' +
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
    'var _hasDsvFooter=function(u8){' +
    '  if(!u8||u8.length<128)return false;' +
    '  var cookie="|-DESMUME SAVE-|";' +
    '  var cOffset=u8.length-16;' +
    '  for(var i=0;i<16;i++){if(u8[cOffset+i]!==cookie.charCodeAt(i))return false;}' +
    '  return true;' +
    '};' +
    'var _collectSaveStems=function(emu,gm){' +
    '  var stems=[];' +
    '  var add=function(s){if(s&&stems.indexOf(s)===-1)stems.push(s);};' +
    '  try{if(typeof gm.getSaveFilePath==="function"){var p=gm.getSaveFilePath();if(p)add(p.replace(/^\\/data\\/saves\\//,"").replace(/\\.[^/.]+$/,""));}}catch(e){}' +
    '  try{if(emu&&typeof emu.getBaseFileName==="function"){add(emu.getBaseFileName());}}catch(e){}' +
    '  try{if(emu&&emu.fileName){add(String(emu.fileName).replace(/^\\//,"").replace(/\\.[^/.]+$/,""));}}catch(e){}' +
    '  if(window.EJS_gameName)add(String(window.EJS_gameName).replace(/\\.[^/.]+$/,""));' +
    '  return stems;' +
    '};' +
    'window.loadSrmData=function(srmBytes,rtcBytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var emu=window.EJS_emulator;' +
    '    var gm=emu.gameManager;' +
    '    var mod=gm.Module||emu.Module;' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    var srmArr=window._toU8(srmBytes);' +
    '    var rtcArr=window._toU8(rtcBytes);' +
    '    var isDsv=_hasDsvFooter(srmArr);' +
    '    var writeFiles=function(){' +
    '      if(!fs||!srmArr)return;' +
    '      try{fs.mkdir("/data");}catch(e){}' +
    '      try{fs.mkdir("/data/saves");}catch(e){}' +
    '      try{' +
    '        if(typeof gm.getSaveFilePath==="function"){' +
    '          var officialPath=gm.getSaveFilePath();' +
    '          if(officialPath){' +
    '            try{fs.unlink(officialPath);}catch(e){}' +
    '            try{fs.writeFile(officialPath,srmArr);}catch(e){}' +
    '          }' +
    '        }' +
    '      }catch(e){}' +
    '      var stems=_collectSaveStems(emu,gm);' +
    '      stems.forEach(function(stem){' +
    '        var base="/data/saves/"+stem;' +
    '        if(_isNds){' +
    '          try{fs.writeFile(base+".dsv",srmArr);}catch(e){}' +
    '          try{fs.writeFile(base+".sav",srmArr);}catch(e){}' +
    '        }else{' +
    '          try{fs.writeFile(base+".srm",srmArr);}catch(e){}' +
    '          try{fs.writeFile(base+".sav",srmArr);}catch(e){}' +
    '        }' +
    '        if(rtcArr){try{fs.writeFile(base+".rtc",rtcArr);}catch(e){}}' +
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
    'window.getSrmData=function(skipFlush){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var emu=window.EJS_emulator;' +
    '    var gm=emu.gameManager;' +
    '    var mod=gm.Module||emu.Module;' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    if(!skipFlush&&typeof gm.saveSaveFiles==="function"){try{gm.saveSaveFiles();}catch(e){}}' +
    '    if(fs&&fs.readFile){' +
    '      var p=typeof gm.getSaveFilePath==="function"?gm.getSaveFilePath():"";' +
    '      if(p){try{var rf=fs.readFile(p);if(rf&&rf.length>0)return new Uint8Array(rf).slice();}catch(e){}}' +
    '      var stems=_collectSaveStems(emu,gm);' +
    '      var exts=_isNds?[".dsv",".sav",".srm"]:[".srm",".sav",".dsv"];' +
    '      for(var s=0;s<stems.length;s++){' +
    '        for(var i=0;i<exts.length;i++){' +
    '          try{var alt=fs.readFile("/data/saves/"+stems[s]+exts[i]);if(alt&&alt.length>0)return new Uint8Array(alt).slice();}catch(e){}' +
    '        }' +
    '      }' +
    '    }' +
    '    if(!skipFlush&&typeof gm.getSaveFile==="function"){' +
    '      var sf=gm.getSaveFile(false);' +
    '      if(sf&&sf.length>0)return new Uint8Array(sf).slice();' +
    '    }' +
    '    if(mod&&mod.HEAPU8){' +
    '      var getMemData=mod._retro_get_memory_data||(gm.functions&&gm.functions.getMemoryData);' +
    '      var getMemSize=mod._retro_get_memory_size||(gm.functions&&gm.functions.getMemorySize);' +
    '      if(typeof getMemData==="function"&&typeof getMemSize==="function"){' +
    '        var ptr=getMemData(0),sz=getMemSize(0);' +
    '        if(ptr&&sz>0)return new Uint8Array(mod.HEAPU8.buffer,ptr,sz).slice();' +
    '      }' +
    '    }' +
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
    '    if(!arr||arr.length<16)return false;' +
    '    if(_isNds&&arr[0]===0x4D&&arr[1]===0x4C&&arr[2]===0x53&&arr[3]===0x4E){' +
    '      console.warn("Skipping incompatible melonDS MLSN state on DeSmuME core");' +
    '      return false;' +
    '    }' +
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
    '  var lastFrames=-1,lastTs=0,goodWindows=0;' +
    '  setInterval(function(){' +
    '    var emu=window.EJS_emulator;' +
    '    if(!emu||!emu.started||emu.paused)return;' +
    '    var now=performance.now();' +
    '    var fc=window.getFrameCount();' +
    '    if(fc>=0){' +
    '      if(lastFrames>=0&&now>lastTs+100){' +
    '        var fps=Math.round(((fc-lastFrames)*1000)/(now-lastTs));' +
    '        if(fps>=0&&fps<=240)window._measuredFps=fps;' +
    '        if(_isNds&&!_ffActive&&emu.gameManager&&typeof emu.gameManager.setVariable==="function"){' +
    '          var nextSkip=_curFrameskip;' +
    '          var minFloor=_canThread?0:1;' +
    '          if(fps<46&&_curFrameskip<3){nextSkip=3;goodWindows=0;}' +
    '          else if(fps<54&&_curFrameskip<2){nextSkip=2;goodWindows=0;}' +
    '          else if(fps<58&&_curFrameskip<1){nextSkip=1;goodWindows=0;}' +
    '          else if(fps>=58&&_curFrameskip>minFloor){' +
    '            goodWindows++;' +
    '            if(goodWindows>=4){nextSkip=_curFrameskip-1;goodWindows=0;}' +
    '          }else{goodWindows=0;}' +
    '          if(nextSkip!==_curFrameskip){' +
    '            _curFrameskip=nextSkip;' +
    '            try{emu.gameManager.setVariable("desmume_frameskip",String(_curFrameskip));}catch(e){}' +
    '          }' +
    '        }' +
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
    '  if(!window._userMuted&&window._resumeAudioContexts)window._resumeAudioContexts();' +
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
    '    var h=0,nonEmpty=false,step=_isNds?32:4;' +
    '    for(var i=0;i<srm.length;i+=step){' +
    '      var b=srm[i];' +
    '      if(b!==0&&b!==255)nonEmpty=true;' +
    '      h=((h<<5)-h+b)|0;' +
    '    }' +
    '    if(nonEmpty&&h!==_lastSrmHash){' +
    '      _lastSrmHash=h;' +
    '      parent.postMessage({type:"ejs-srm-update",save:srm instanceof Uint8Array?srm:new Uint8Array(srm)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '},_isNds?10000:4000);' +
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
    '      var gm=window.EJS_emulator.gameManager;' +
    '      if(gm&&typeof gm.setVariable==="function"&&_isNds){' +
    '        gm.setVariable("desmume_frameskip",String(_curFrameskip));' +
    '        gm.setVariable("desmume_cpu_mode","jit");' +
    '        gm.setVariable("desmume_num_cores",_ndsCores);' +
    '        gm.setVariable("desmume_advanced_timing","disabled");' +
    '        gm.setVariable("desmume_pointer_type","touch");' +
    '        gm.setVariable("desmume_pointer_mouse","enabled");' +
    '        gm.setVariable("desmume_gfx_edgemark","disabled");' +
    '        gm.setVariable("desmume_gfx_linehack","disabled");' +
    '        gm.setVariable("melonds_touch_mode","Touch");' +
    '        gm.setVariable("melonds_threaded_renderer","enabled");' +
    '        gm.setVariable("melonds_audio_interpolation","none");' +
    '      }' +
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
    '      window.setInputBitmask(0);' +
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
    'document.addEventListener("touchstart",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' +
    'document.addEventListener("touchmove",function(e){if(e.cancelable)e.preventDefault();},{passive:false});' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}
