import AppKit
import Foundation
import PDFKit
import Vision

struct OCRLine: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRPage: Codable {
    let pageNumber: Int
    let width: Double
    let height: Double
    let lines: [OCRLine]
}

guard CommandLine.arguments.count >= 3 else {
    FileHandle.standardError.write(Data("usage: ocr-pdf <input.pdf> <output.json>\n".utf8))
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let document = PDFDocument(url: inputURL) else {
    FileHandle.standardError.write(Data("unable to open PDF\n".utf8))
    exit(1)
}

var output: [OCRPage] = []
let scale: CGFloat = 2.4

for pageIndex in 0..<document.pageCount {
    guard let page = document.page(at: pageIndex) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let pixelWidth = max(1, Int(bounds.width * scale))
    let pixelHeight = max(1, Int(bounds.height * scale))
    guard let context = CGContext(
        data: nil,
        width: pixelWidth,
        height: pixelHeight,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { continue }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    guard let image = context.makeImage() else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hant", "en-US", "id-ID"]
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
    try handler.perform([request])

    let lines = (request.results ?? []).compactMap { observation -> OCRLine? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return OCRLine(
            text: candidate.string,
            confidence: candidate.confidence,
            x: box.origin.x,
            y: box.origin.y,
            width: box.width,
            height: box.height
        )
    }.sorted { left, right in
        if abs(left.y - right.y) > 0.008 { return left.y > right.y }
        return left.x < right.x
    }

    output.append(OCRPage(
        pageNumber: pageIndex + 1,
        width: Double(bounds.width),
        height: Double(bounds.height),
        lines: lines
    ))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(output).write(to: outputURL, options: .atomic)
print("OCR \(document.pageCount) page(s) -> \(outputURL.path)")
