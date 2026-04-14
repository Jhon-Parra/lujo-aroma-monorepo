"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = generateSlug;
function generateSlug(text) {
    if (!text)
        return '';
    return text
        .toString()
        .normalize('NFD') // split an accented letter in the base letter and the accent
        .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 -]/g, '') // remove all chars not letters, numbers, spaces or hyphens
        .replace(/\s+/g, '-') // collapse spaces into hyphens
        .replace(/-+/g, '-'); // collapse multiple hyphens into one
}
