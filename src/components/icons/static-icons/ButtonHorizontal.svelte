<style>
  svg {
    position:absolute;
  }

  .icon-container{
    width:18px;
    height:18px;
  }
</style>

<div class='icon-container'>
<svg width="89px" height="89px" viewBox="0 0 92 89" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>Button-horizontal</title>
  <defs>
      <linearGradient x1="11.0839844%" y1="8.67704504%" x2="82.4017693%" y2="100%" id="linearGradient-1">
          <stop stop-color="#3E454D" offset="0%"></stop>
          <stop stop-color="#17191C" offset="100%"></stop>
      </linearGradient>
      <rect id="path-2" x="95" y="17" width="40" height="40" rx="20"></rect>
      <filter x="-85.0%" y="-85.0%" width="300.0%" height="300.0%" filterUnits="objectBoundingBox" id="filter-3">
          <feGaussianBlur stdDeviation="4" in="SourceGraphic"></feGaussianBlur>
      </filter>
      <filter x="-127.5%" y="-127.5%" width="385.0%" height="385.0%" filterUnits="objectBoundingBox" id="filter-4">
          <feOffset dx="-4" dy="-4" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
          <feGaussianBlur stdDeviation="8" in="shadowOffsetOuter1" result="shadowBlurOuter1"></feGaussianBlur>
          <feColorMatrix values="0 0 0 0 0.764705882   0 0 0 0 0.784313725   0 0 0 0 0.803921569  0 0 0 0.18 0" type="matrix" in="shadowBlurOuter1" result="shadowMatrixOuter1"></feColorMatrix>
          <feOffset dx="6" dy="6" in="SourceAlpha" result="shadowOffsetOuter2"></feOffset>
          <feGaussianBlur stdDeviation="14" in="shadowOffsetOuter2" result="shadowBlurOuter2"></feGaussianBlur>
          <feColorMatrix values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.3 0" type="matrix" in="shadowBlurOuter2" result="shadowMatrixOuter2"></feColorMatrix>
          <feMerge>
              <feMergeNode in="shadowMatrixOuter1"></feMergeNode>
              <feMergeNode in="shadowMatrixOuter2"></feMergeNode>
          </feMerge>
      </filter>
  </defs>
  <g id="Neu-4" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g id="Button-horizontal" transform="translate(-74.000000, 0.000000)" filter="url(#filter-3)">
          <use fill="black" fill-opacity="1" filter="url(#filter-4)" xlink:href="#path-2"></use>
          <use fill="url(#linearGradient-1)" fill-rule="evenodd" xlink:href="#path-2"></use>
      </g>
  </g>
</svg>
</div>