<template>
  <main class="forus-grid px-4 py-10 flex min-h-screen items-center justify-center relative overflow-hidden">
    <div class="rounded-full bg-teal-400/10 h-80 w-80 pointer-events-none left-1/2 top-0 absolute blur-3xl -translate-x-1/2" />
    <div class="max-w-md w-full relative">
      <div class="mb-8 flex justify-center">
        <AppBrand />
      </div>
      <slot />
    </div>
  </main>
</template>
