<template>
  <div class="body-blocks">
    <template v-for="(block, index) in blocks" :key="index">
      <component :is="`h${block.level}`" v-if="block.type === 'heading'" class="article-heading">
        <InlineText :spans="block.children" />
      </component>
      <p v-else-if="block.type === 'paragraph'"><InlineText :spans="block.children" /></p>
      <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><InlineText :spans="item" /></li>
      </component>
      <blockquote v-else-if="block.type === 'quote'"><InlineText :spans="block.children" /></blockquote>
      <figure v-else-if="block.type === 'image'" class="article-image-wrap">
        <button class="image-button" type="button" @click="$emit('open-image', imageUrl(block))" :aria-label="`放大图片：${block.alt || '正文图片'}`">
          <img :src="imageUrl(block)" :alt="block.alt || '正文图片'" loading="lazy" />
        </button>
        <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
      </figure>
      <hr v-else-if="block.type === 'divider'" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Asset, BodyBlock } from '~/contracts/types'
const props = defineProps<{ blocks: BodyBlock[]; assets: Record<string, Asset> }>()
defineEmits<{ 'open-image': [url: string] }>()
const imageUrl = (block: Extract<BodyBlock, { type: 'image' }>) => block.assetId ? props.assets[block.assetId]?.publicUrl || '' : block.sourceUrl || ''
</script>
