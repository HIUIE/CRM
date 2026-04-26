import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * 将 DOM 元素导出为多页 PDF 报告。
 *
 * 自动注入 .screenshot-safe 类以解除 sticky 定位，
 * 避免 html2canvas 截取时出现拼接撕裂。
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string = 'export',
): Promise<void> {
  // 注入截图安全模式 — 解除所有 sticky 定位
  document.documentElement.classList.add('screenshot-safe');

  try {
    // 等待一帧，确保 DOM 完成重排
    await new Promise((r) => requestAnimationFrame(r));

    // 使用 html2canvas 将 DOM 渲染为高保真 Canvas
    const canvas = await html2canvas(element, {
      scale: 2, // 2x 高清
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      // 允许跨域图片加载
      allowTaint: false,
    });

    // A4 尺寸 (mm) — 竖版
    const pageWidth = 210;
    const pageHeight = 297;

    // 计算每页对应的 Canvas 像素高度
    const pxPerPage = (canvas.width * pageHeight) / pageWidth;
    const totalPages = Math.ceil(canvas.height / pxPerPage);

    // 创建 PDF 实例
    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      // 从完整 Canvas 中切出当前页
      const sliceY = i * pxPerPage;
      const sliceHeight = Math.min(pxPerPage, canvas.height - sliceY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d')!;
      ctx.drawImage(
        canvas,
        0,
        sliceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      // 将切片注入 PDF
      const imgHeight = (sliceHeight * pageWidth) / canvas.width;
      pdf.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        pageWidth,
        imgHeight,
      );
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    // 恢复 — 移除截图安全模式
    document.documentElement.classList.remove('screenshot-safe');
  }
}
