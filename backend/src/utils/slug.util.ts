export function generateSlug(text: string): string {
    if (!text) return '';
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
