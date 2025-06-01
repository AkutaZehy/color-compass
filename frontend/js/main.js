// frontend/js/main.js

// 使用 DOMContentLoaded 确保整个 HTML 文档加载并解析完毕后再执行脚本
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // 获取 HTML 元素
  const imageInput = document.getElementById('imageInput');
  const uploadedImage = document.getElementById('uploadedImage');

  // 检查元素是否存在，防止脚本错误
  if (!imageInput || !uploadedImage) {
    console.error("Error: Required HTML elements not found. Check index.html IDs.");
    return; // 如果找不到关键元素，停止执行
  }

  // 为文件输入框添加 'change' 事件监听器
  imageInput.addEventListener('change', function (event) {
    // event.target.files 是一个 FileList 对象，包含用户选择的文件
    const files = event.target.files;

    // 检查用户是否选择了文件
    if (files && files.length > 0) {
      const selectedFile = files[0]; // 获取第一个文件 (通常用户只选择一个)

      console.log(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size} bytes)`);

      // 调用 imageHandler 中的函数来加载和显示图片
      loadImageAndDisplay(selectedFile, uploadedImage)
        .then(loadedImgElement => {
          // 图片成功加载并显示后，可以在这里执行下一步操作
          console.log("Image loading and display successful. Ready for next steps.");
          // TODO: 在这里调用调色板提取、颜色分析等函数
        })
        .catch(error => {
          // 处理加载过程中发生的错误
          console.error("Error during image loading process:", error);
          alert("无法加载图片。请确保文件是有效的图片格式。"); // 给用户一个提示
        });

    } else {
      // 用户取消了文件选择
      console.log("File selection cancelled.");
      uploadedImage.style.display = 'none'; // 隐藏图片
      uploadedImage.src = '#'; // 重置 src
    }

    // 清空 input 的 value，这样即使选择了同一个文件，change 事件也会再次触发
    // event.target.value = null; // 可选，根据需求决定是否需要
  });

  console.log("main.js script finished execution. Waiting for user interaction.");
});