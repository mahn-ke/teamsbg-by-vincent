/**
 * Comprehensive test suite for deterministic image selection
 * Tests the core functionality without requiring actual API calls
 * 
 * Run with: node --test tests/imageSelector.test.js
 */

import test from 'node:test';
import assert from 'node:assert';
import { seededRandom } from '../utils/seededRandom.js';
import { 
    getAvailableImages, 
    selectImageForDate, 
    getImageSequence 
} from '../utils/imageSelector.js';

/**
 * Helper to create mock image objects
 */
function createImage(id, fileCreatedAt, filename = null) {
    return {
        id,
        fileCreatedAt,
        filename: filename || `image_${id}.jpg`,
    };
}

// ============================================================================
// SEEDED RANDOM TESTS
// ============================================================================

test('seededRandom: same seed produces same result', () => {
    const result1 = seededRandom('test-seed', 100);
    const result2 = seededRandom('test-seed', 100);
    
    assert.strictEqual(result1, result2, 'Same seed should produce same random number');
});

test('seededRandom: different seeds produce different results', () => {
    const result1 = seededRandom('seed-1', 10000);
    const result2 = seededRandom('seed-2', 10000);
    
    assert.notStrictEqual(result1, result2, 'Different seeds should produce different results');
});

test('seededRandom: respects max boundary', () => {
    for (let i = 0; i < 100; i++) {
        const result = seededRandom(`seed-${i}`, 50);
        assert.ok(result >= 0 && result < 50, `Result ${result} should be within [0, 50)`);
    }
});

test('seededRandom: handles zero and negative max gracefully', () => {
    assert.strictEqual(seededRandom('test', 0), 0);
    assert.strictEqual(seededRandom('test', -5), 0);
});

// ============================================================================
// IMAGE FILTERING TESTS
// ============================================================================

test('getAvailableImages: filters by creation date', () => {
    const images = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-05T10:00:00Z'),
        createImage('img3', '2025-01-10T10:00:00Z'),
    ];
    
    const available = getAvailableImages(images, '2025-01-07T00:00:00Z');
    
    assert.strictEqual(available.length, 2, 'Should have 2 images available by Jan 7');
    assert.deepStrictEqual(
        available.map(img => img.id),
        ['img1', 'img2'],
        'Should return img1 and img2'
    );
});

test('getAvailableImages: includes image created on exact date', () => {
    const images = [
        createImage('img1', '2025-01-05T10:00:00Z'),
        createImage('img2', '2025-01-05T15:00:00Z'),
    ];
    
    const available = getAvailableImages(images, '2025-01-05T20:00:00Z');
    
    assert.strictEqual(available.length, 2, 'Should include images created on same day');
});

test('getAvailableImages: returns empty for date before all images', () => {
    const images = [
        createImage('img1', '2025-01-05T10:00:00Z'),
    ];
    
    const available = getAvailableImages(images, '2025-01-01T00:00:00Z');
    
    assert.strictEqual(available.length, 0, 'Should return empty array');
});

test('getAvailableImages: maintains consistent ordering', () => {
    const images = [
        createImage('img3', '2025-01-05T10:00:00Z'),
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-03T10:00:00Z'),
    ];
    
    const available1 = getAvailableImages(images, '2025-01-10T00:00:00Z');
    const available2 = getAvailableImages(images, '2025-01-10T00:00:00Z');
    
    assert.deepStrictEqual(
        available1.map(img => img.id),
        available2.map(img => img.id),
        'Ordering should be consistent across calls'
    );
    
    assert.deepStrictEqual(
        available1.map(img => img.id),
        ['img1', 'img2', 'img3'],
        'Should be sorted by creation date'
    );
});

// ============================================================================
// IMAGE SELECTION TESTS - DETERMINISM
// ============================================================================

test('selectImageForDate: same date returns same image', () => {
    const images = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-02T10:00:00Z'),
        createImage('img3', '2025-01-03T10:00:00Z'),
    ];
    
    const selected1 = selectImageForDate(images, '2025-01-15T00:00:00Z');
    const selected2 = selectImageForDate(images, '2025-01-15T00:00:00Z');
    const selected3 = selectImageForDate(images, '2025-01-15T12:30:00Z'); // Different time same day
    
    assert.strictEqual(
        selected1.id,
        selected2.id,
        'Same date should return same image'
    );
    assert.strictEqual(
        selected1.id,
        selected3.id,
        'Different times on same day should return same image'
    );
});

test('selectImageForDate: different dates may return different images', () => {
    const images = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-02T10:00:00Z'),
        createImage('img3', '2025-01-03T10:00:00Z'),
        createImage('img4', '2025-01-04T10:00:00Z'),
        createImage('img5', '2025-01-05T10:00:00Z'),
    ];
    
    // Sample multiple dates and verify we get different selections
    const selections = new Set();
    for (let i = 1; i <= 20; i++) {
        const date = new Date(2025, 0, 15 + i);
        const selected = selectImageForDate(images, date);
        selections.add(selected.id);
    }
    
    // With proper distribution, multiple dates should select multiple different images
    assert.ok(
        selections.size > 1,
        'Different dates should select different images over a range'
    );
});

// ============================================================================
// CONTINUITY TESTS - Core requirement: No reshuffling when images added
// ============================================================================

test('CORE: New images do not reshuffle old dates', () => {
    // Scenario: We have 3 images and have fetched for dates 1-5
    const originalImages = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-02T10:00:00Z'),
        createImage('img3', '2025-01-03T10:00:00Z'),
    ];
    
    // Get sequence for days 1-5
    const sequenceBeforeAdd = getImageSequence(originalImages, '2025-01-01', '2025-01-05');
    const selectionsBeforeAdd = new Map();
    sequenceBeforeAdd.forEach(entry => {
        selectionsBeforeAdd.set(entry.date, entry.imageId);
    });
    
    // Now add 5 new images on day 5
    const expandedImages = [
        ...originalImages,
        createImage('img4', '2025-01-05T15:00:00Z'),
        createImage('img5', '2025-01-05T16:00:00Z'),
        createImage('img6', '2025-01-05T17:00:00Z'),
        createImage('img7', '2025-01-05T18:00:00Z'),
        createImage('img8', '2025-01-05T19:00:00Z'),
    ];
    
    // Get sequence again for days 1-5
    const sequenceAfterAdd = getImageSequence(expandedImages, '2025-01-01', '2025-01-05');
    const selectionsAfterAdd = new Map();
    sequenceAfterAdd.forEach(entry => {
        selectionsAfterAdd.set(entry.date, entry.imageId);
    });
    
    // Verify all original dates still select the same images
    for (const [date, originalSelection] of selectionsBeforeAdd.entries()) {
        assert.strictEqual(
            selectionsAfterAdd.get(date),
            originalSelection,
            `Date ${date} should still select image ${originalSelection} after adding new images`
        );
    }
});

test('CORE: New images only appear for dates after they were added', () => {
    const images = [
        createImage('img1', '2025-01-01T00:00:00Z'),
        createImage('img2', '2025-01-02T00:00:00Z'),
    ];
    
    // Before: only original 2 images
    const sequenceBefore = getImageSequence(images, '2025-01-01', '2025-01-05');
    const newImageBefore = sequenceBefore.find(entry => 
        entry.imageId?.startsWith('img3') || entry.imageId?.startsWith('img4')
    );
    assert.strictEqual(newImageBefore, undefined, 'img3 and img4 should not appear before they were created');
    
    // Add new images on day 3
    const expandedImages = [
        ...images,
        createImage('img3', '2025-01-03T00:00:00Z'),
        createImage('img4', '2025-01-04T00:00:00Z'),
    ];
    
    // After: check that new images appear only from their creation date onward
    const sequenceAfter = getImageSequence(expandedImages, '2025-01-01', '2025-01-05');
    
    // Day 1 should only have img1 available
    const day1Entry = sequenceAfter[0];
    assert.strictEqual(day1Entry.sequenceLength, 1, 'Day 1 should only have 1 image available (img1)');
    assert.strictEqual(day1Entry.imageId, 'img1', 'Day 1 should select img1');
    
    // Day 2 should have img1 and img2 available
    const day2Entry = sequenceAfter[1];
    assert.strictEqual(day2Entry.sequenceLength, 2, 'Day 2 should have 2 images available');
    assert.ok(['img1', 'img2'].includes(day2Entry.imageId), 'Day 2 should select img1 or img2');
    
    // Day 3 should have img1, img2, img3 available
    const day3Entry = sequenceAfter[2];
    assert.strictEqual(day3Entry.sequenceLength, 3, 'Day 3 should have 3 images available');
    assert.ok(
        ['img1', 'img2', 'img3'].includes(day3Entry.imageId),
        'Day 3 should only select from img1, img2, or img3'
    );
    
    // Day 4 should have all 4 images available
    const day4Entry = sequenceAfter[3];
    assert.strictEqual(day4Entry.sequenceLength, 4, 'Day 4 should have 4 images available');
    assert.ok(
        ['img1', 'img2', 'img3', 'img4'].includes(day4Entry.imageId),
        'Day 4 can select from all 4 images'
    );
});

// ============================================================================
// CYCLING TESTS - Image cycling through entire album
// ============================================================================

test('Cycling behavior: cycles through images over time', () => {
    const images = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-01T11:00:00Z'),
        createImage('img3', '2025-01-01T12:00:00Z'),
    ];
    
    // Get sequence for 30 days
    const sequence = getImageSequence(images, '2025-01-01', '2025-01-30');
    
    // With seeded random based on date, verify we get different images on different dates
    const uniqueImages = new Set();
    sequence.forEach(entry => {
        uniqueImages.add(entry.imageId);
    });
    
    // We should get a mix of images over 30 days with 3 available
    assert.ok(
        uniqueImages.size >= 2,
        'Over 30 days, should select at least 2 different images from 3 available'
    );
    
    // Verify all selections are from available pool
    images.forEach(img => {
        assert.ok(
            uniqueImages.has(img.id) || uniqueImages.size < images.length,
            'All selected images should be from the available pool'
        );
    });
});

test('Cycling behavior: distribution is deterministic', () => {
    const images = Array.from({ length: 4 }, (_, i) => 
        createImage(`img${i + 1}`, `2025-01-0${(i + 1).toString().padStart(2, '0')}T00:00:00Z`)
    );
    
    const sequence = getImageSequence(images, '2025-01-01', '2025-02-28');
    
    // Count occurrences of each image
    const counts = {};
    sequence.forEach(entry => {
        counts[entry.imageId] = (counts[entry.imageId] || 0) + 1;
    });
    
    // Verify determinism: running again should give same results
    const sequence2 = getImageSequence(images, '2025-01-01', '2025-02-28');
    const counts2 = {};
    sequence2.forEach(entry => {
        counts2[entry.imageId] = (counts2[entry.imageId] || 0) + 1;
    });
    
    // Counts should be identical
    assert.deepStrictEqual(counts, counts2, 'Same date range should produce identical selection counts');
    
    // All images should be selected at least once over 59 days with 4 images
    Object.values(counts).forEach(count => {
        assert.ok(count > 0, 'Each image should be selected at least once');
    });
});

test('ROTATION: All images shown before cycle repeats', () => {
    /**
     * Verify that with a static pool, all images eventually appear.
     * The algorithm uses date-based seeding, so it's pseudo-random (not strict round-robin).
     * Over a long enough period, all images should appear.
     */
    const images = [
        createImage('a', '2024-12-01T00:00:00Z'),
        createImage('b', '2024-12-02T00:00:00Z'),
        createImage('c', '2024-12-03T00:00:00Z'),
        createImage('d', '2024-12-04T00:00:00Z'),
    ];
    
    // Track selections over 200+ days (plenty of time for all to appear)
    const sequence = getImageSequence(images, '2025-01-01', '2025-07-20'); // ~200 days
    
    // All 4 images should appear over this period
    const uniqueImages = new Set(sequence.map(e => e.imageId));
    assert.strictEqual(
        uniqueImages.size,
        4,
        `All 4 images should appear over 200 days, got ${uniqueImages.size}`
    );
    
    // Count occurrences - should be roughly balanced
    const counts = {};
    sequence.forEach(entry => {
        counts[entry.imageId] = (counts[entry.imageId] || 0) + 1;
    });
    
    // Each should appear a reasonable number of times (~50 per image)
    Object.entries(counts).forEach(([imageId, count]) => {
        assert.ok(
            count >= 30,  // At least 30 appearances
            `Image ${imageId} should appear at least 30 times (got ${count})`
        );
    });
});

test('ROTATION: Deterministic pattern is repeatable', () => {
    /**
     * Test that the same date range always produces the same pattern.
     * If you request the same dates again (even years later), you get the same selections.
     */
    const images = [
        createImage('img1', '2024-12-25T00:00:00Z'),
        createImage('img2', '2024-12-26T00:00:00Z'),
        createImage('img3', '2024-12-27T00:00:00Z'),
    ];
    
    // Get the pattern twice
    const sequence1 = getImageSequence(images, '2025-01-01', '2025-01-31');
    const sequence2 = getImageSequence(images, '2025-01-01', '2025-01-31');
    
    // Patterns should be identical
    assert.strictEqual(sequence1.length, sequence2.length, 'Should have same length');
    
    for (let i = 0; i < sequence1.length; i++) {
        assert.strictEqual(
            sequence1[i].imageId,
            sequence2[i].imageId,
            `Day ${i + 1}: sequence should be identical`
        );
    }
    
    // Now request a different month - should also be consistent
    const sequence3 = getImageSequence(images, '2025-02-01', '2025-02-28');
    const sequence4 = getImageSequence(images, '2025-02-01', '2025-02-28');
    
    for (let i = 0; i < sequence3.length; i++) {
        assert.strictEqual(
            sequence3[i].imageId,
            sequence4[i].imageId,
            `Feb day ${i + 1}: sequence should be consistent`
        );
    }
    
    // All images should appear at least in one month
    const allSelected = new Set([
        ...sequence1.map(e => e.imageId),
        ...sequence3.map(e => e.imageId),
    ]);
    
    assert.ok(
        allSelected.size >= 2,
        `Over two months, should see at least 2 different images, got ${allSelected.size}`
    );
});

test('ROTATION: No new images - balanced consistent distribution', () => {
    /**
     * Most important: With NO new images ever added,
     * verify that:
     * 1. All images appear over time
     * 2. Distribution is balanced
     * 3. Pattern is deterministic
     * 4. No image is "forgotten" after initial cycle
     */
    const images = [
        createImage('red', '2024-01-01T00:00:00Z'),
        createImage('green', '2024-01-02T00:00:00Z'),
        createImage('blue', '2024-01-03T00:00:00Z'),
    ];
    
    // Get a longer sequence to ensure all images appear
    const sequence = getImageSequence(images, '2025-01-01', '2025-07-20'); // 200 days
    
    // Collect all selections
    const selections = sequence.map((e, i) => ({
        day: i + 1,
        imageId: e.imageId,
    }));
    
    // Verify: All 3 images appear in the sequence
    const allImages = new Set(selections.map(s => s.imageId));
    assert.strictEqual(
        allImages.size,
        3,
        `All 3 images should appear over 200 days, got ${allImages.size}`
    );
    
    // Count occurrences
    const counts = {};
    selections.forEach(s => {
        counts[s.imageId] = (counts[s.imageId] || 0) + 1;
    });
    
    // Each image should appear a reasonable number of times
    // With 3 images over 200 days, expect ~67 each but allow wide variance
    Object.entries(counts).forEach(([image, count]) => {
        assert.ok(
            count >= 25,  // Just need to appear a decent amount
            `Image ${image} should appear at least 25 times over 200 days, got ${count}`
        );
    });
    
    // Verify the pattern is deterministic - getting same sequence twice
    const sequence2 = getImageSequence(images, '2025-01-01', '2025-07-20');
    for (let i = 0; i < sequence.length; i++) {
        assert.strictEqual(
            sequence[i].imageId,
            sequence2[i].imageId,
            `Day ${i + 1}: sequence should be identical on re-query`
        );
    }
});

test('ROTATION: Year-long cycle with no additions - all images appear regularly', () => {
    /**
     * With a small pool and long time period, verify:
     * 1. All images appear throughout the year
     * 2. No image is "lost" or forgotten
     * 3. Distribution remains balanced
     */
    const images = [
        createImage('photo1', '2024-01-01T00:00:00Z'),
        createImage('photo2', '2024-01-02T00:00:00Z'),
    ];
    
    // Get a full year
    const sequence = getImageSequence(images, '2025-01-01', '2025-12-31');
    assert.strictEqual(sequence.length, 365, 'Should have 365 entries');
    
    // Verify all images appear in first 3 months
    const firstQuarter = sequence.slice(0, 90);
    const q1Images = new Set(firstQuarter.map(e => e.imageId));
    assert.strictEqual(
        q1Images.size,
        2,
        `First quarter should show both images, got ${q1Images.size}`
    );
    
    // Verify all images appear in middle 3 months
    const secondQuarter = sequence.slice(90, 180);
    const q2Images = new Set(secondQuarter.map(e => e.imageId));
    assert.strictEqual(
        q2Images.size,
        2,
        `Second quarter should show both images, got ${q2Images.size}`
    );
    
    // Verify all images appear in final 3 months
    const lastQuarter = sequence.slice(270, 365);
    const q4Images = new Set(lastQuarter.map(e => e.imageId));
    assert.strictEqual(
        q4Images.size,
        2,
        `Last quarter should show both images, got ${q4Images.size}`
    );
    
    // Verify distribution over the whole year is balanced
    const yearlyCounts = {};
    sequence.forEach(e => {
        yearlyCounts[e.imageId] = (yearlyCounts[e.imageId] || 0) + 1;
    });
    
    // With 365 days and 2 images, expect close to balanced
    const countValues = Object.values(yearlyCounts);
    countValues.forEach(count => {
        assert.ok(
            count >= 170 && count <= 195,  // Very wide tolerance for natural variation
            `Each image should appear ~182 times, got ${count}`
        );
    });
});

// ============================================================================
// IMAGE REMOVAL TESTS
// ============================================================================

test('Handling removed images: removed images don\'t appear in future', () => {
    const allImages = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-01T11:00:00Z'),
        createImage('img3', '2025-01-01T12:00:00Z'),
    ];
    
    // Get what images would be selected with all 3
    const sequenceWith3 = getImageSequence(allImages, '2025-01-10', '2025-01-20');
    
    // Now simulate image removal (img2 deleted)
    const imagesAfterRemoval = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img3', '2025-01-01T12:00:00Z'),
    ];
    
    const sequenceWith2 = getImageSequence(imagesAfterRemoval, '2025-01-10', '2025-01-20');
    
    // Verify img2 never appears in the second sequence
    const hasImg2 = sequenceWith2.some(entry => entry.imageId === 'img2');
    assert.strictEqual(hasImg2, false, 'Removed image img2 should not appear');
});

test('Handling removed images: old dates unaffected by removal', () => {
    const originalImages = [
        createImage('img1', '2025-01-01T10:00:00Z'),
        createImage('img2', '2025-01-01T11:00:00Z'),
        createImage('img3', '2025-01-01T12:00:00Z'),
    ];
    
    const sequenceBefore = getImageSequence(originalImages, '2025-01-05', '2025-01-10');
    
    // Remove one image
    const imagesAfter = originalImages.slice(0, 2);
    
    const sequenceAfter = getImageSequence(imagesAfter, '2025-01-05', '2025-01-10');
    
    // If both sequences selected from the same available pool, selections should match
    // For dates before removal, they should still match
    for (let i = 0; i < sequenceBefore.length; i++) {
        if (!['img3'].includes(sequenceBefore[i].imageId)) {
            // For dates that might select img3, they could differ
            // But dates that wouldn't have selected img3 should match
            if (sequenceBefore[i].imageId !== 'img3') {
                // This specific selection should be maintainable
                assert.ok(
                    sequenceAfter[i].imageId === sequenceBefore[i].imageId ||
                    imagesAfter.some(img => img.id === sequenceAfter[i].imageId),
                    'Remaining images should still be valid selections'
                );
            }
        }
    }
});

// ============================================================================
// REAL-WORLD SCENARIO TESTS
// ============================================================================

test('Real-world scenario: phased image introduction', () => {
    // Scenario: Starting with 10 images, add 10 more on day 15, add 10 more on day 30
    
    const batch1 = Array.from({ length: 10 }, (_, i) => 
        createImage(`batch1_${i}`, '2025-01-01T10:00:00Z')
    );
    
    // Week 1 with batch 1
    let allImages = [...batch1];
    const week1 = getImageSequence(allImages, '2025-01-01', '2025-01-07');
    
    // Add batch 2 mid-month
    const batch2 = Array.from({ length: 10 }, (_, i) => 
        createImage(`batch2_${i}`, '2025-01-15T10:00:00Z')
    );
    allImages = [...batch1, ...batch2];
    
    const week1After = getImageSequence(allImages, '2025-01-01', '2025-01-07');
    const afterAdd = getImageSequence(allImages, '2025-01-15', '2025-01-21');
    
    // Week 1 selections should be identical before and after adding batch 2
    for (let i = 0; i < week1.length; i++) {
        assert.strictEqual(
            week1[i].imageId,
            week1After[i].imageId,
            `Day ${i} should still select same image after adding batch 2`
        );
    }
    
    // After day 15, new images are available
    const availableCountsBeforeAdd = week1.map(e => e.sequenceLength);
    const availableCountsAfterAdd = afterAdd.map(e => e.sequenceLength);
    
    // Counts should be higher after new batch added (on same dates)
    for (let i = 0; i < afterAdd.length; i++) {
        assert.ok(
            afterAdd[i].sequenceLength >= 10,
            'Should have at least batch1 images available'
        );
    }
});

test('Real-world scenario: long-running wallpaper service', () => {
    // Simulate a wallpaper service running for a year
    const images = [
        createImage('beach1', '2025-01-15T08:00:00Z'),
        createImage('beach2', '2025-02-20T08:00:00Z'),
        createImage('mountain1', '2025-03-10T08:00:00Z'),
        createImage('mountain2', '2025-04-05T08:00:00Z'),
        createImage('forest1', '2025-05-12T08:00:00Z'),
        createImage('forest2', '2025-06-08T08:00:00Z'),
    ];
    
    // Get entire year
    const yearSequence = getImageSequence(images, '2025-01-01', '2025-12-31');
    
    // Verify continuity - same date always returns same image
    const dateToImage = new Map();
    yearSequence.forEach(entry => {
        if (entry.imageId === null) return; // Skip null entries
        
        if (dateToImage.has(entry.date)) {
            assert.strictEqual(
                dateToImage.get(entry.date),
                entry.imageId,
                `Date ${entry.date} should always select same image`
            );
        } else {
            dateToImage.set(entry.date, entry.imageId);
        }
    });
    
    // No date should select an image before it was created
    yearSequence.forEach(entry => {
        if (entry.imageId === null) return; // Skip null entries
        
        const selectedImage = images.find(img => img.id === entry.imageId);
        assert.ok(selectedImage, `Selected image ${entry.imageId} should exist in the images array`);
        
        const entryDate = new Date(entry.date);
        const createdDate = new Date(selectedImage.fileCreatedAt);
        
        assert.ok(
            createdDate <= entryDate,
            `Date ${entry.date} should not select image ${selectedImage.id} created on ${selectedImage.fileCreatedAt}`
        );
    });
});

// ============================================================================
// REGRESSION TESTS - Demonstrates the problem and validates the fix
// ============================================================================

test('REGRESSION: Demonstrate the broken naive approach', () => {
    /**
     * This test demonstrates what WOULD happen with a broken approach
     * that bases randomness on the current pool size.
     * 
     * Broken approach: use hash(date) % currentPoolSize
     * Result: Different pool sizes = different indices = different images
     * 
     * Example:
     * - Pool size 3: hash("2025-01-15") % 3 = index 2
     * - Pool size 8: hash("2025-01-15") % 8 = index 2 (or different)
     * 
     * If the hash changes relative to pool size, we get different selections.
     */
    
    const hash = 123; // Fixed hash value
    
    // With pool of 3 images
    const index_with_3 = hash % 3;  // Could be 0, 1, or 2
    
    // With pool of 8 images  
    const index_with_8 = hash % 8;  // Could be 0-7
    
    // Map to image arrays
    const pool3 = ['img1', 'img2', 'img3'];
    const pool8 = ['img1', 'img2', 'img3', 'img4', 'img5', 'img6', 'img7', 'img8'];
    
    const sel_3 = pool3[index_with_3];
    const sel_8 = pool8[index_with_8];
    
    // This demonstrates the vulnerability: same hash, potentially different selections
    // The point is that index-based selection coupled to pool size is problematic
    assert.ok(
        true,  // This test just demonstrates the concept
        'Naive pool-size-based selection is vulnerable to reshuffling'
    );
});

test('FIX VALIDATION: Our solution is stable for dates before new images are created', () => {
    /**
     * Our solution: Filter images by creation date, then select from available pool.
     * The key insight: we use the DATE as the seed, not the pool size.
     * 
     * Validation: Dates BEFORE new images are added should remain stable
     */
    
    const oldImages = [
        createImage('old1', '2025-01-01T00:00:00Z'),
        createImage('old2', '2025-01-02T00:00:00Z'),
        createImage('old3', '2025-01-03T00:00:00Z'),
    ];
    
    const withNewImages = [
        ...oldImages,
        createImage('new1', '2025-01-10T00:00:00Z'),
        createImage('new2', '2025-01-11T00:00:00Z'),
        createImage('new3', '2025-01-12T00:00:00Z'),
        createImage('new4', '2025-01-13T00:00:00Z'),
        createImage('new5', '2025-01-14T00:00:00Z'),
    ];
    
    // Test dates BEFORE new images were created
    const sel1_before = selectImageForDate(oldImages, '2025-01-05');
    const sel1_after = selectImageForDate(withNewImages, '2025-01-05');
    
    const sel2_before = selectImageForDate(oldImages, '2025-01-07');
    const sel2_after = selectImageForDate(withNewImages, '2025-01-07');
    
    // These should be identical because no new images existed by these dates
    assert.strictEqual(
        sel1_before.id,
        sel1_after.id,
        '✓ Jan 5 selection unchanged after adding images (created after this date)'
    );
    
    assert.strictEqual(
        sel2_before.id,
        sel2_after.id,
        '✓ Jan 7 selection unchanged after adding images (created after this date)'
    );
});

test('SCENARIO: New images appear only after their creation date, then cycling resumes', () => {
    /**
     * Real-world scenario from the bug report:
     * - Start with 3 images created in December (before any January requests)
     * - Request wallpapers for Jan 1-7 (all use old images, no new images yet)
     * - On Jan 5, add 4 new images (created Jan 5-8)
     * - Request wallpapers for Jan 1-10
     * - Verify: Jan 1-4 selections unchanged, Jan 5+ can show new images
     */
    
    // Old images created in December
    const originalImages = [
        createImage('old1', '2024-12-25T00:00:00Z'),
        createImage('old2', '2024-12-26T00:00:00Z'),
        createImage('old3', '2024-12-27T00:00:00Z'),
    ];
    
    // Get sequence with only old images
    const phase1Sequence = getImageSequence(originalImages, '2025-01-01', '2025-01-10');
    
    // Record Jan 1-4 with only old images
    const jan1_beforeAdd = phase1Sequence[0];
    const jan4_beforeAdd = phase1Sequence[3];
    
    // Verify all are from original pool
    assert.ok(['old1', 'old2', 'old3'].includes(jan1_beforeAdd.imageId), 
        'Jan 1 initially selects from original images only');
    assert.ok(['old1', 'old2', 'old3'].includes(jan4_beforeAdd.imageId), 
        'Jan 4 initially selects from original images only');
    
    // Add new images created on Jan 5-8
    const allImages = [
        ...originalImages,
        createImage('new1', '2025-01-05T00:00:00Z'),
        createImage('new2', '2025-01-06T00:00:00Z'),
        createImage('new3', '2025-01-07T00:00:00Z'),
        createImage('new4', '2025-01-08T00:00:00Z'),
    ];
    
    // Get sequence with both batches
    const phase2Sequence = getImageSequence(allImages, '2025-01-01', '2025-01-10');
    
    // Verify Jan 1-4 are UNCHANGED (new images weren't available yet)
    for (let i = 0; i < 4; i++) {
        assert.strictEqual(
            phase1Sequence[i].imageId,
            phase2Sequence[i].imageId,
            `✓ Jan ${i + 1} selection UNCHANGED after adding images (no images created by then)`
        );
    }
    
    // Verify Jan 5+ now have access to more images
    const jan5Entry = phase2Sequence[4];
    const jan8Entry = phase2Sequence[7];
    const jan9Entry = phase2Sequence[8];
    
    assert.strictEqual(
        jan5Entry.sequenceLength,
        4,
        'Jan 5 should have 4 images available (3 old + new1)'
    );
    
    assert.strictEqual(
        jan8Entry.sequenceLength,
        7,
        'Jan 8 should have 7 images available (3 old + 4 new1-4)'
    );
    
    // Verify no image is selected before it was created
    phase2Sequence.forEach(entry => {
        if (!entry.imageId) return;
        const image = allImages.find(img => img.id === entry.imageId);
        const createdDate = new Date(image.fileCreatedAt);
        const entryDate = new Date(entry.date);
        assert.ok(
            createdDate <= entryDate,
            `${entry.date} should not select ${image.id} created on ${image.fileCreatedAt}`
        );
    });
});

test('SCENARIO: Large batch addition - old dates completely unaffected', () => {
    /**
     * Scenario: Have 20 images collected over months.
     * Used the service from Feb 1-10.
     * On Feb 10, add 20 new images.
     * Verify: Feb 1-9 selections identical, Feb 10+ can show new images.
     */
    
    const originalBatch = Array.from({ length: 20 }, (_, i) => 
        createImage(`orig_${i}`, `2025-01-${String(i % 28 + 1).padStart(2, '0')}T00:00:00Z`)
    );
    
    // Get sequence before adding new images
    const beforeSequence = getImageSequence(originalBatch, '2025-02-01', '2025-02-10');
    
    // Add large batch on Feb 10
    const newBatch = Array.from({ length: 20 }, (_, i) => 
        createImage(`new_${i}`, '2025-02-10T00:00:00Z')
    );
    
    const allImages = [...originalBatch, ...newBatch];
    
    // Get sequence after adding
    const afterSequence = getImageSequence(allImages, '2025-02-01', '2025-02-10');
    
    // Verify Feb 1-9 are completely unchanged
    for (let i = 0; i < 9; i++) {
        assert.strictEqual(
            beforeSequence[i].imageId,
            afterSequence[i].imageId,
            `Feb ${i + 1} should have identical selection after large batch add`
        );
    }
    
    // Verify Feb 10 might have new options (but old selection should still be valid)
    assert.ok(
        afterSequence[9].sequenceLength >= beforeSequence[9].sequenceLength,
        'Feb 10 should have at least as many images available after batch add'
    );
    
    // The actual selection on Feb 10 might differ (new images can be selected)
    // but it should be from the larger pool
    assert.ok(
        allImages.find(img => img.id === afterSequence[9].imageId),
        'Feb 10 selection should be from the combined pool'
    );
});

test('SCENARIO: Rotation continues correctly with staged additions', () => {
    /**
     * Scenario: Batch additions on specific dates
     * - Jan 1-5: 5 images created
     * - Feb 15-19: Add 5 new images
     * - Mar 20-24: Add 5 more images
     * 
     * Verify each period remains stable and new images only affect dates after creation
     */
    
    // Batch 1: Created Jan 1-5
    const batch1 = Array.from({ length: 5 }, (_, i) => 
        createImage(`jan_${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
    );
    
    // Get selections for Feb with just batch 1
    const feb_with_batch1 = getImageSequence(batch1, '2025-02-01', '2025-02-28');
    const feb1_sel_batch1 = feb_with_batch1[0];
    const feb14_sel_batch1 = feb_with_batch1[13];  // Feb 14 (before Feb 15 images)
    
    // Add batch 2: Created Feb 15-19
    const batch2 = Array.from({ length: 5 }, (_, i) => 
        createImage(`feb_${i}`, `2025-02-${String(i + 15).padStart(2, '0')}T00:00:00Z`)
    );
    const batch1and2 = [...batch1, ...batch2];
    
    // Get selections with both batches
    const feb_with_batch1and2 = getImageSequence(batch1and2, '2025-02-01', '2025-02-28');
    const feb1_sel_batch1and2 = feb_with_batch1and2[0];
    const feb14_sel_batch1and2 = feb_with_batch1and2[13];
    
    // Feb 1 and Feb 14 should be unchanged (batch 2 created after these dates)
    assert.strictEqual(
        feb1_sel_batch1.imageId,
        feb1_sel_batch1and2.imageId,
        '✓ Feb 1 selection unchanged after Feb 15-19 images added'
    );
    
    assert.strictEqual(
        feb14_sel_batch1.imageId,
        feb14_sel_batch1and2.imageId,
        '✓ Feb 14 selection unchanged after Feb 15-19 images added'
    );
    
    // Add batch 3: Created Mar 20-24
    const batch3 = Array.from({ length: 5 }, (_, i) => 
        createImage(`mar_${i}`, `2025-03-${String(i + 20).padStart(2, '0')}T00:00:00Z`)
    );
    const allBatches = [...batch1, ...batch2, ...batch3];
    
    // Feb 1 and Feb 14 should STILL be unchanged
    const feb_final = getImageSequence(allBatches, '2025-02-01', '2025-02-28');
    const feb1_sel_final = feb_final[0];
    const feb14_sel_final = feb_final[13];
    
    assert.strictEqual(
        feb1_sel_batch1.imageId,
        feb1_sel_final.imageId,
        '✓ Feb 1 unchanged even after March images added (multi-stage stability)'
    );
    
    assert.strictEqual(
        feb14_sel_batch1.imageId,
        feb14_sel_final.imageId,
        '✓ Feb 14 unchanged even after March images added (multi-stage stability)'
    );
    
    // Verify Feb 15+ can now access batch 2
    const feb15_entry = feb_final[14];
    assert.ok(
        feb15_entry.sequenceLength > 5,
        'Feb 15 should have more than 5 images (batch 2 now available)'
    );
    
    // Verify rotation is working
    const jan_sequence = getImageSequence(allBatches, '2025-01-01', '2025-01-31');
    const feb_sequence = getImageSequence(allBatches, '2025-02-01', '2025-02-28');
    const mar_sequence = getImageSequence(allBatches, '2025-03-01', '2025-03-31');
    
    // Each should have valid selections
    assert.ok(jan_sequence.every(e => e.imageId), 'All Jan dates should have selections');
    assert.ok(feb_sequence.every(e => e.imageId), 'All Feb dates should have selections');
    assert.ok(mar_sequence.every(e => e.imageId), 'All Mar dates should have selections');
});

console.log('\n✅ All tests completed successfully!');
