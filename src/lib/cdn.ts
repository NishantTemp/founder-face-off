// ImageKit Configuration
// Note: Base URL is handled by ImageKitProvider in main.tsx
const IMAGE_PATH_PREFIX = '/list/';

// Mapping of usernames (without @) to their file extensions
// Based on actual files in ImageKit CDN
export const imageExtensions: Record<string, string> = {
  'levelsio': 'jpg',
  'im_roy_lee': 'jpeg',
  'IndraVahan': 'png',
  'itsandrewgao': 'png',
  'arvidkahl': 'jpeg',
  'dannypostmaa': 'jpeg',
  'tdinh_me': 'jpeg',
  'marc_louvion': 'jpeg',
  'burkaygur': 'jpg',
  'zach_yadegari': 'jpeg',
  'tibo_maker': 'jpeg',
  'desmondhth': 'jpeg',
  'jackfriks': 'jpeg',
  'blakeandersonw': 'jpeg',
  'SaidAitmbarek': 'jpeg',
  'rexan_wong': 'jpeg',
  'Davidjpark96': 'jpeg',
  'themkmaker': 'jpg',
  'DhravyaShah': 'jpeg',
  'amanrsanger': 'jpg',
  'hunterjisaacson': 'jpeg',
  'YoniSmolyar': 'jpg',
  'zachdive': 'jpeg',
  'antonosika': 'jpeg',
  'AravSrinivas': 'webp',
  '_mattwelter': 'png',
  'alexsllater': 'jpeg',
  'eddybuild': 'jpg',
  'cjzafir': 'jpg',
  'nizzyabi': 'jpeg',
  'athasdev': 'jpg',
  'birdabo404': 'jpg',
  'yacineMTB': 'png',
  'pattybuilds': 'jpeg',
  'mazeincoding': 'jpg',
  'salimnunez01': 'jpg',
  'SherryYanJiang': 'jpg',
  'ibocodes': 'jpg',
  'theo': 'jpg',
  'eunifiedworld': 'jpeg',
  'not_nang': 'jpg',
  'iosifache': 'jpg',
  'zaidmukaddam': 'jpeg',
  'ionkarbatra': 'jpeg',
  'siyabuilt': 'jpeg',
  'katherineh4_': 'jpeg',
  'miranda_nover': 'jpeg',
  'weswinder': 'jpg',
  'ralabs_': 'jpg',
  'TomsCe': 'jpg'
};

/**
 * Generates an ImageKit path for a founder's image
 * @param username - The username without @ symbol (e.g., 'levelsio')
 * @returns The relative path for ImageKit Image component
 */
export function getImageKitPath(username: string): string {
  const cleanUsername = username.replace('@', '');
  const extension = imageExtensions[cleanUsername];
  
  if (!extension) {
    console.warn(`No image extension found for username: ${cleanUsername}`);
    // Fallback to default extension
    return `${IMAGE_PATH_PREFIX}${cleanUsername}.jpg`;
  }
  
  return `${IMAGE_PATH_PREFIX}${cleanUsername}.${extension}`;
}

/**
 * Converts a local image path to ImageKit path
 * @param localPath - Local path like "/list/levelsio.jpg"
 * @returns ImageKit relative path
 */
export function convertLocalToImageKit(localPath: string): string {
  // Extract filename from path like "/list/levelsio.jpg"
  const filename = localPath.split('/').pop();
  if (!filename) return localPath;
  
  // Extract username and extension
  const [username] = filename.split('.');
  return getImageKitPath(username);
}

/**
 * Validates if a username has a corresponding image
 * @param username - Username to check
 * @returns boolean indicating if image exists
 */
export function hasImage(username: string): boolean {
  const cleanUsername = username.replace('@', '');
  return cleanUsername in imageExtensions;
}

/**
 * Gets all available image usernames
 * @returns Array of usernames that have images
 */
export function getAvailableImageUsernames(): string[] {
  return Object.keys(imageExtensions);
}

export default {
  getImageKitPath,
  convertLocalToImageKit,
  hasImage,
  getAvailableImageUsernames,
  IMAGE_PATH_PREFIX
}; 