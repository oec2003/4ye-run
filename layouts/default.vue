<template>
  <div class="layout-default">
    <header>
      <div class="site-title">跑者日历四野群周末云跑速递</div>
    </header>
    
    <main>
      <slot />
    </main>

    <footer>
      <p>&copy; 2024 跑者日历四野群</p>
    </footer>
  </div>
</template>

<style scoped>
.layout-default {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  padding: 1.5rem 1rem;
  background: linear-gradient(to right, #f5f5f5, #e0e0e0, #f5f5f5);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.site-title {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(45deg, #00dc82 30%, #00b4d8 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  letter-spacing: 2px;
  position: relative;
  padding: 10px 0;
}

.site-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 3px;
  background: linear-gradient(to right, transparent, #00dc82, transparent);
}

main {
  flex: 1;
  padding: 2rem;
}

footer {
  padding: 1rem;
  text-align: center;
  background-color: #f5f5f5;
  position: relative;
  overflow: hidden;
}

footer p {
  margin: 0;
  padding: 0;
  color: #666;
}

/* 移动端优化 */
@media screen and (max-width: 768px) {
  .site-title {
    font-size: 1.6rem;
    letter-spacing: 1px;
  }

  header {
    padding: 1rem 0.5rem;
  }
}
</style> 