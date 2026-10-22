export const maxPictureBytes = 1024 * 1024;

export function validatePicture(png) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!Buffer.isBuffer(png) || png.length < 45 || png.length > maxPictureBytes
        || !png.subarray(0, 8).equals(signature)
        || png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR'
        || png.readUInt32BE(16) < 1 || png.readUInt32BE(16) > 1024
        || png.readUInt32BE(20) < 1 || png.readUInt32BE(20) > 1024
        || !png.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))) {
        throw new TypeError('Upload a PNG picture up to 1 MB and 1024 × 1024 pixels.');
    }
}

export function decodePicture(value) {
    if (value === null) return null;
    const prefix = 'data:image/png;base64,';
    if (typeof value !== 'string' || !value.startsWith(prefix) || value.length > 1400000)
        throw new TypeError('Choose a valid PNG picture.');
    const encoded = value.slice(prefix.length);
    const png = Buffer.from(encoded, 'base64');
    if (png.toString('base64') !== encoded) throw new TypeError('Choose a valid PNG picture.');
    validatePicture(png);
    return png;
}
