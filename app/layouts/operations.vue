<template>
  <div class="min-h-screen">
    <AppSidebar />
    <AppHeader />
    <main class="lg:ml-64">
      <slot />
    </main>
    <AppMobileNav />
  </div>
</template>
