import type { getDocument } from 'pdfjs-dist';
import type { Canvas } from '@napi-rs/canvas';
import type { NodeCanvasFactory } from 'pdfjs-dist/types/src/display/node_utils';
import * as sharp from 'sharp';

export async function generateThumbnail(imageBuffer: Uint8Array): Promise<Uint8Array> {
  return await sharp(imageBuffer)
    .rotate()
    .resize({ width: 200, height: 200, position: 'top' })
    .greyscale()
    .toFormat(sharp.format.png, { quality: 30, palette: true })
    .toBuffer();
}

const CMAP_URL = 'node_modules/pdfjs-dist/cmaps/';
const CMAP_PACKED = true;

const STANDARD_FONT_DATA_URL = 'node_modules/pdfjs-dist/standard_fonts/';

export async function generatePdfThumbnail(pdfBuffer: Uint8Array): Promise<Uint8Array> {
  // dynamic import of esm dependency
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as { getDocument: typeof getDocument };

  const loadingTask = pdfjs.getDocument({
    data: pdfBuffer,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  const pdfDocument = await loadingTask.promise;
  const page = await pdfDocument.getPage(1);

  const canvasFactory = pdfDocument.canvasFactory as NodeCanvasFactory;
  const viewport = page.getViewport({ scale: 1.0 });
  const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: canvasAndContext.context,
    viewport,
  };

  const renderTask = page.render(renderContext);
  await renderTask.promise;
  // Convert the canvas to an image buffer.
  const image = (canvasAndContext.canvas as unknown as Canvas).toBuffer('image/png');
  const thumbnail = await generateThumbnail(image);
  page.cleanup();
  return thumbnail;
}
