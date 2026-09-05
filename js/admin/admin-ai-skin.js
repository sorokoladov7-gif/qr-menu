/* QR MENU — Qrchick visual shell: premium admin skin. */
(function(){
  'use strict';

  if(window.__QR_ADMIN_AI_SKIN__) return;
  window.__QR_ADMIN_AI_SKIN__=true;

  if(!/\/admin\.html$/i.test(location.pathname)) return;

  function css(){
    if(document.getElementById('qrchick-premium-skin')) return;

    var s=document.createElement('style');
    s.id='qrchick-premium-skin';

    s.textContent=`

      /* =========================================================
         QRCHICK — PREMIUM ADMIN SKIN
         ========================================================= */

      :root{
        --qc-blue:#168cff;
        --qc-cyan:#5ee7ff;
        --qc-navy:#06152f;
        --qc-ink:#071a38;
        --qc-muted:#7186a5;
        --qc-card:rgba(255,255,255,.78);
      }


      /* =========================================================
         ADMIN BACKGROUND
         ========================================================= */

      body.qrchick-premium{
        background:
          linear-gradient(
            135deg,
            #edf6ff 0%,
            #f7fbff 42%,
            #eaf4ff 100%
          ) !important;

        color:#102448 !important;
      }

      body.qrchick-premium:before{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:-1;

        background:
          radial-gradient(
            circle at 70% 15%,
            rgba(30,144,255,.16),
            transparent 32%
          ),
          radial-gradient(
            circle at 5% 75%,
            rgba(0,190,255,.10),
            transparent 28%
          );
      }


      /* =========================================================
         TOPBAR
         ========================================================= */

      body.qrchick-premium .topbar{
        background:rgba(255,255,255,.82) !important;
        border-bottom:1px solid rgba(35,91,150,.10) !important;

        box-shadow:
          0 8px 28px rgba(26,83,138,.08) !important;

        backdrop-filter:blur(18px);
      }

      body.qrchick-premium .wrap{
        max-width:1420px !important;
      }


      /* =========================================================
         GLASS CARDS
         ========================================================= */

      body.qrchick-premium .glass{
        background:rgba(255,255,255,.76) !important;
        border:1px solid rgba(71,133,191,.16) !important;

        box-shadow:
          0 12px 35px rgba(38,92,145,.09) !important;

        color:#102448 !important;

        backdrop-filter:blur(16px);
      }

      body.qrchick-premium .muted,
      body.qrchick-premium .lbl{
        color:#7186a5 !important;
      }


      /* =========================================================
         TABS
         ========================================================= */

      body.qrchick-premium .tabs{
        background:rgba(255,255,255,.58) !important;
        border:1px solid rgba(71,133,191,.13) !important;

        box-shadow:
          0 8px 24px rgba(38,92,145,.07) !important;

        backdrop-filter:blur(14px);
      }

      body.qrchick-premium .tabs button{
        color:#405676 !important;
        border-color:transparent !important;
      }

      body.qrchick-premium .tabs button.on{
        background:
          linear-gradient(
            135deg,
            #147cf0,
            #2baeff
          ) !important;

        color:#fff !important;

        box-shadow:
          0 9px 24px rgba(20,126,239,.28) !important;
      }


      /* =========================================================
         PRIMARY BUTTON
         ========================================================= */

      body.qrchick-premium .btn-primary{
        background:
          linear-gradient(
            135deg,
            #087cf0,
            #21b7ff
          ) !important;

        border-color:transparent !important;

        box-shadow:
          0 8px 22px rgba(8,124,240,.22);
      }


      /* =========================================================
         AI CENTER
         ========================================================= */

      #qr-ai-center{
        z-index:2147483000 !important;
      }


      /* =========================================================
         AI FAB
         ========================================================= */

      #qr-ai-fab{
        width:78px !important;
        height:78px !important;

        border-radius:50% !important;
        padding:0 !important;

        background:
          radial-gradient(
            circle at 50% 42%,
            #123c78 0,
            #06152e 62%,
            #020817 100%
          ) !important;

        border:2px solid rgba(62,196,255,.78) !important;

        box-shadow:
          0 0 0 5px rgba(22,140,255,.08),
          0 0 28px rgba(24,157,255,.60),
          0 18px 44px rgba(7,48,105,.32) !important;

        font-size:0 !important;
        overflow:visible !important;

        animation:
          qcFloat 3.2s ease-in-out infinite;
      }

      #qr-ai-fab:before{
        content:"";

        display:block;

        width:100%;
        height:100%;

        background-image:
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='31' fill='%23020916' stroke='%231aaaff' stroke-width='2'/%3E%3Cpath d='M24 38C9 15 49 5 65 18C89 12 94 45 79 57C89 79 56 95 39 78C15 85 5 53 24 38Z' fill='none' stroke='%23128fff' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M28 69C47 50 56 27 78 31M21 47C41 64 63 71 82 51' fill='none' stroke='%235ee7ff' stroke-width='2'/%3E%3Ccircle cx='40' cy='48' r='5' fill='%23c7f7ff'/%3E%3Ccircle cx='60' cy='48' r='5' fill='%23c7f7ff'/%3E%3Cpath d='M39 63Q50 72 61 63' fill='none' stroke='%23bdf6ff' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E");

        background-size:cover;
        background-position:center;

        filter:
          drop-shadow(
            0 0 8px rgba(76,220,255,.75)
          );
      }

      #qr-ai-fab:after{
        content:"";

        position:absolute;

        right:-1px;
        bottom:3px;

        width:14px;
        height:14px;

        border-radius:50%;

        background:#20d77a;

        border:3px solid #07172f;

        box-shadow:
          0 0 12px rgba(32,215,122,.9);
      }


      /* =========================================================
         AI DRAWER
         ========================================================= */

      #qr-ai-drawer{
        width:min(470px,calc(100vw - 28px)) !important;
        height:min(820px,calc(100dvh - 105px)) !important;

        right:18px !important;
        bottom:108px !important;

        border-radius:25px !important;

        background:
          linear-gradient(
            180deg,
            rgba(5,23,53,.985),
            rgba(4,12,28,.99)
          ) !important;

        border:1px solid rgba(64,181,255,.46) !important;

        box-shadow:
          0 30px 90px rgba(1,20,52,.55),
          0 0 45px rgba(14,131,255,.18) !important;
      }


      /* =========================================================
         AI HEADER
         ========================================================= */

      .qr-ai-head{
        padding:17px 18px !important;

        background:
          linear-gradient(
            180deg,
            rgba(28,77,143,.72),
            rgba(9,31,68,.72)
          ) !important;

        border-bottom:
          1px solid rgba(91,190,255,.20) !important;
      }

      .qr-ai-head:before{
        content:"";

        width:46px;
        height:46px;

        flex:0 0 46px;

        border-radius:50%;

        background:
          radial-gradient(
            circle,
            #143e78,
            #030d21
          );

        border:1px solid #20aaff;

        box-shadow:
          0 0 18px rgba(21,157,255,.55);

        margin-right:1px;
      }

      .qr-ai-title{
        color:#fff !important;
        font-size:16px !important;
      }

      .qr-ai-subtitle{
        color:#a9c2e4 !important;
      }

      .qr-ai-head button{
        background:rgba(255,255,255,.07) !important;
        color:#fff !important;
        border-color:rgba(255,255,255,.12) !important;
      }


      /* =========================================================
         AI MODES
         ========================================================= */

      .qr-ai-modes{
        background:rgba(2,13,31,.58) !important;
        border-bottom-color:rgba(91,190,255,.15) !important;
      }

      .qr-ai-modes button{
        background:rgba(22,86,145,.28) !important;
        border-color:rgba(78,177,255,.20) !important;
        color:#dff5ff !important;
      }

      .qr-ai-modes button:hover{
        background:rgba(22,126,215,.42) !important;
      }


      /* =========================================================
         AI COMPOSER
         ========================================================= */

      .qr-ai-compose{
        background:rgba(3,14,31,.78) !important;
        border-top-color:rgba(91,190,255,.15) !important;
      }

      #qr-ai-message{
        background:rgba(255,255,255,.055) !important;

        border:
          1px solid rgba(86,180,255,.22) !important;

        color:#f5fbff !important;

        border-radius:15px !important;
      }

      #qr-ai-message::placeholder{
        color:#7895b8 !important;
      }

      .qr-ai-actions .btn{
        border-radius:12px !important;
      }

      .qr-ai-status{
        color:#87a9cf !important;
      }


      /* =========================================================
         AI ASSISTANT AVATAR
         ========================================================= */

      .qr-ai-avatar{
        background:rgba(19,110,180,.28) !important;

        border:
          1px solid rgba(70,191,255,.28) !important;

        color:#aeeeff !important;

        overflow:hidden;
      }

      .qr-ai-assistant .qr-ai-avatar{
        font-size:0 !important;
      }

      .qr-ai-assistant .qr-ai-avatar:before{
        content:"";

        display:block;

        width:100%;
        height:100%;

        background:
          radial-gradient(
            circle at 50% 50%,
            #0e8eff 0 8%,
            #071a38 9% 52%,
            transparent 53%
          );

        box-shadow:
          inset 0 0 12px rgba(73,220,255,.45);
      }


      /* =========================================================
         ANIMATION
         ========================================================= */

      @keyframes qcFloat{
        0%,100%{
          transform:translateY(0);
        }

        50%{
          transform:translateY(-5px);
        }
      }


      /* =========================================================
         MOBILE
         ========================================================= */

      @media(max-width:900px){

        #qr-ai-fab{
          width:66px !important;
          height:66px !important;

          right:14px !important;

          bottom:
            max(
              14px,
              env(safe-area-inset-bottom)
            ) !important;
        }

        #qr-ai-drawer{
          right:10px !important;
          bottom:88px !important;

          width:calc(100vw - 20px) !important;

          height:
            min(
              760px,
              calc(100dvh - 100px)
            ) !important;
        }

        .qr-ai-actions{
          grid-template-columns:
            1fr 1fr !important;
        }
      }


      /* =========================================================
         REDUCED MOTION
         ========================================================= */

      @media(prefers-reduced-motion:reduce){

        #qr-ai-fab{
          animation:none !important;
        }
      }

    `;

    document.head.appendChild(s);
  }


  function enhance(){

    css();

    document.body.classList.add('qrchick-premium');

    var root=document.getElementById('qr-ai-center');

    if(!root) return false;


    /* =========================================================
       AI FAB
       ========================================================= */

    var fab=document.getElementById('qr-ai-fab');

    if(fab&&!fab.dataset.qcEnhanced){

      fab.dataset.qcEnhanced='1';

      fab.setAttribute(
        'title',
        'Qrchick — ИИ-помощник'
      );
    }


    /* =========================================================
       AI DRAWER
       ========================================================= */

    var drawer=document.getElementById('qr-ai-drawer');

    if(!drawer||drawer.dataset.qcEnhanced) return true;

    drawer.dataset.qcEnhanced='1';

    return true;
  }


  function boot(){

    if(enhance()) return;

    var observer=new MutationObserver(function(){

      if(enhance()){
        observer.disconnect();
      }

    });

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );

    setTimeout(function(){
      enhance();
    },1200);
  }


  if(document.readyState==='loading'){

    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {once:true}
    );

  }else{

    boot();

  }

})();
