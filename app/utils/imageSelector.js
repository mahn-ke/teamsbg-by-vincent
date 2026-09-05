/**
 * Deterministic image selection based on dates
 * Ensures that:
 * - Same date always returns same image (deterministic)
 * - New images don't reshuffle old dates
 * - Images phase in based on their creation date
 * - Removed images don't break the sequence
 */

import { seededRandom } from './seededRandom.js';

/**
 * Represent an image with metadata
 * @typedef {Object} Image
 * @property {string} id - Unique identifier
 * @property {string} fileCreatedAt - ISO datetime string of creation
 * @property {string} [filename] - Optional filename
 */

/**
 * Filter images to only those available on a given date
 * An image is available if it was created before or on the requested date
 * @param {Image[]} allImages - All images in the album
 * @param {Date|string} requestDate - Date to check availability for
 * @returns {Image[]} Filtered images available on that date
 */
export function getAvailableImages(allImages, requestDate) {
    const cutoffDate = new Date(requestDate);
    
    return allImages.filter(img => {
        const createdDate = new Date(img.fileCreatedAt);
        return createdDate <= cutoffDate;
    }).sort((a, b) => {
        // Maintain consistent ordering by creation date, then ID
        const dateA = new Date(a.fileCreatedAt);
        const dateB = new Date(b.fileCreatedAt);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        return a.id.localeCompare(b.id);
    });
}

/**
 * Select an image for a given date deterministically
 * The selection is based on the date, ensuring the same date always
 * returns the same image regardless of when the request is made.
 * 
 * @param {Image[]} allImages - All images in the album
 * @param {Date|string} requestDate - Date to select image for
 * @returns {Image|null} Selected image, or null if no images available
 */
export function selectImageForDate(allImages, requestDate) {
    const availableImages = getAvailableImages(allImages, requestDate);
    
    if (availableImages.length === 0) {
        return null;
    }
    
    // Use date as seed for deterministic randomness
    // Convert to ISO string to ensure consistent seed format
    const dateString = new Date(requestDate).toISOString().split('T')[0]; // YYYY-MM-DD
    const seedValue = `${dateString}`;
    
    // Deterministically select an image from available ones
    const selectedIndex = seededRandom(seedValue, availableImages.length);
    
    return availableImages[selectedIndex];
}

/**
 * Get the sequence of images for a date range
 * Useful for testing and understanding the selection pattern
 * 
 * @param {Image[]} allImages - All images in the album
 * @param {Date|string} startDate - Start date (inclusive)
 * @param {Date|string} endDate - End date (inclusive)
 * @returns {Array<{date: string, imageId: string, imageName: string, sequenceLength: number}>} 
 *          Sequence of selected images for each date
 */
export function getImageSequence(allImages, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const sequence = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const current = new Date(d);
        const available = getAvailableImages(allImages, current);
        const selected = selectImageForDate(allImages, current);
        
        sequence.push({
            date: current.toISOString().split('T')[0],
            imageId: selected ? selected.id : null,
            imageName: selected ? selected.filename || selected.id : null,
            sequenceLength: available.length,
        });
    }
    
    return sequence;
}
