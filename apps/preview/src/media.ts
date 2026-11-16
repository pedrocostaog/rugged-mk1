/**
 * The feed every page plays (laptop scene, console, workbench preview).
 * Paste the Mux playback ID here; the asset's playback policy must be public.
 * Leave it empty to fall back to the Video.js demo asset (Cosmic Dawn).
 */
export const MUX_PLAYBACK_ID = 'lfELV8IGbAxZajvZ302FhuCfI1FDUOKcN023sWLJsGRgY';

const DEMO_PLAYBACK_ID = '83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s';

export const usesDemoAsset = MUX_PLAYBACK_ID.trim() === '';
const id = usesDemoAsset ? DEMO_PLAYBACK_ID : MUX_PLAYBACK_ID.trim();

export const FEED = {
  src: `https://stream.mux.com/${id}.m3u8`,
  poster: `https://image.mux.com/${id}/thumbnail.webp?time=${usesDemoAsset ? 69 : 4}`,
  title: usesDemoAsset ? 'Cosmic Dawn // Sector 01' : 'Go Forward to the Moon',
  /** The bundled subtitle/chapter VTTs are timed to Cosmic Dawn only. */
  tracks: usesDemoAsset,
};
