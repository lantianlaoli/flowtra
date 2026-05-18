export type AssetsDetailSurfaceMode = 'embedded' | 'modal';

export const getAssetsDetailSurfaceMode = (embedded: boolean): AssetsDetailSurfaceMode =>
  embedded ? 'embedded' : 'modal';
