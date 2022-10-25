<template>
  <div v-editable="blok" class="private-asset-form-container">
    <div class="private-asset-form">
      <form @submit.prevent="fakeSubmitForm">
        <input type="email" :value="email" required />
        <button role="submit">Submit</button>
      </form>
    </div>
    <PrivateAssetLink
      v-if="isFormSubmissionSuccessful"
      :assetFilename="blok.asset.filename"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import PrivateAssetLink from "./PrivateAssetLink.vue";

const props = defineProps({ blok: Object });
const email = ref("");
const isFormSubmissionSuccessful = ref(false);

const fakeSubmitForm = () => {
  isFormSubmissionSuccessful.value = true;
};
</script>

<style scoped>
.private-asset-form-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.private-asset-form {
  margin-bottom: 2rem;
}

input {
  font-family: Arial, Helvetica, sans-serif;
  padding: 0.75rem;
  border: 2px solid darkcyan;
  border-radius: 0.5rem;
  margin-right: 0.75rem;
}

button {
  font-family: Arial, Helvetica, sans-serif;
  padding: 0.75rem;
  background-color: darkcyan;
  border: 2px solid darkcyan;
  border-radius: 0.5rem;
  color: white;
  transition: all 0.3s;
}

button:hover {
  cursor: pointer;
  background-color: darkslateblue;
  border-color: darkslateblue;
}
</style>
