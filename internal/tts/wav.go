package tts

import "encoding/binary"

// WrapPCM24kToWAV wraps 24,000Hz 16-bit Mono Little-Endian raw PCM audio in a
// 44-byte RIFF WAV container for standard browser HTML5 <audio> playback.
func WrapPCM24kToWAV(pcm []byte) []byte {
	const (
		sampleRate    = 24000
		numChannels   = 1
		bitsPerSample = 16
		byteRate      = sampleRate * numChannels * (bitsPerSample / 8) // 48,000
		blockAlign    = numChannels * (bitsPerSample / 8)              // 2
	)

	dataLen := uint32(len(pcm))
	chunkSize := 36 + dataLen

	header := make([]byte, 44)
	copy(header[0:4], "RIFF")
	binary.LittleEndian.PutUint32(header[4:8], chunkSize)
	copy(header[8:12], "WAVE")
	copy(header[12:16], "fmt ")
	binary.LittleEndian.PutUint32(header[16:20], 16) // Subchunk1Size for PCM
	binary.LittleEndian.PutUint16(header[20:22], 1)  // AudioFormat 1 = PCM
	binary.LittleEndian.PutUint16(header[22:24], numChannels)
	binary.LittleEndian.PutUint32(header[24:28], sampleRate)
	binary.LittleEndian.PutUint32(header[28:32], byteRate)
	binary.LittleEndian.PutUint16(header[32:34], blockAlign)
	binary.LittleEndian.PutUint16(header[34:36], bitsPerSample)
	copy(header[36:40], "data")
	binary.LittleEndian.PutUint32(header[40:44], dataLen)

	result := make([]byte, 44+len(pcm))
	copy(result[:44], header)
	copy(result[44:], pcm)
	return result
}
