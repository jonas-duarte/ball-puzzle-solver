import { PuzzleSolver } from '@/core/PuzzleSolver'
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import Tesseract, { createWorker } from 'tesseract.js'

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

function getBase64FromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const dataURL = canvas.toDataURL('image/png')
    resolve(dataURL)
  })
}

function removeBackground(imageData: ImageData): void {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    if (r < 60 && g < 110 && b < 150) {
      const br = b / r;
      const bg = b / g;
      if (br > 1.5 && bg > 1.1) {
        r = 0
        g = 0
        b = 0
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function convertCharToWhite(imageData: ImageData): void {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    if (r > 100 || g > 100 || b > 100) {
      r = 255
      g = 255
      b = 255
    } else {
      r = 0
      g = 0
      b = 0
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function invertColors(imageData: ImageData): void {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    r = 255 - r
    g = 255 - g
    b = 255 - b

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

type Area = {
  x: number
  y: number
  width: number
  height: number
}

function findLine(imageData: ImageData, area?: Area): Partial<Area> | null {
  const data = imageData.data;

  if (!area) {
    area = {
      x: 0,
      y: 0,
      width: imageData.width,
      height: imageData.height
    }
  }

  const line: Partial<Area> = {}

  let found = 0
  const lastY = area.y + area.height
  for (let x = area.x; x < area.x + area.width; x++) {
    found = 0

    for (let y = area.y; y < lastY; y++) {
      const isBlack = data[(y * imageData.width + x) * 4] === 0
      if (isBlack && !found) {
        line.x = x
        line.y = y
        found = 5
      }

      // paint for debug
      // if (found) {
      //   data[(y * imageData.width + x) * 4] = 255
      //   data[(y * imageData.width + x) * 4 + 1] = 0
      //   data[(y * imageData.width + x) * 4 + 2] = 0
      // } else {
      //   data[(y * imageData.width + x) * 4] = 0
      //   data[(y * imageData.width + x) * 4 + 1] = 255
      //   data[(y * imageData.width + x) * 4 + 2] = 0
      // }

      if (found && (!isBlack || y === lastY - 1)) {
        const height = y - line.y!;
        if (height < 100) {
          found = 0
          continue
        }
        line.height = height
        return line
      }
    }


  }
  return null
}


function findContainer(imageData: ImageData): Area | null {

  const line1: Partial<Area> = findLine(imageData)!
  if (!line1) return null

  const line2: Partial<Area> = findLine(imageData, {
    x: line1.x! + 10,
    y: line1.y! - 10,
    width: imageData.width - line1.x! - 10,
    height: line1.height!
  })!

  if (!line2) return null

  const container: Area = {
    x: line1.x! + 10,
    y: line1.y!,
    width: line2.x! - line1.x! - 18,
    height: line1.height! - 10
  }

  return container
}


function removePuzzleContainers(imageData: ImageData): void {
  const data = imageData.data

  while (true) {
    const container = findContainer(imageData)
    if (!container) break

    const cleanSize = 15

    for (let x = container.x - cleanSize; x < container.x + container.width + cleanSize; x++) {
      for (let y = container.y - cleanSize; y < container.y + container.height + cleanSize; y++) {
        const isInsideContainer = x > container.x && x < container.x + container.width && y > container.y && y < container.y + container.height
        if (isInsideContainer) continue
        data[(y * imageData.width + x) * 4] = 255
        data[(y * imageData.width + x) * 4 + 1] = 255
        data[(y * imageData.width + x) * 4 + 2] = 255
      }
    }
  }

}

async function createPuzzleWorker(image: string): Promise<string> {
  const worker = await createWorker();

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJ ' // Specify the characters to recognize
  });

  const { data: { text } } = await worker.recognize(image);

  await worker.terminate();

  return text
}

async function puzzleParser(text: string): Promise<{ puzzle: string[][], size: number }> {
  const SIZE = 4

  const puzzle: string[][] = []

  let items: string[][] = text
    .split('\n')
    .filter(item => item.trim())
    .map(item => item.split(' '))

  if (items.length === SIZE * 2) {
    for (let i = 0; i < SIZE; i++) {
      const row = items[i + SIZE];
      items[i] = [...items[i], ...row]
      items[i + SIZE] = null!
    }
    items = items.filter(item => item)
  }


  while (true) {
    const row: string[] = []
    if (!items[0].length) break
    for (let i = 0; i < SIZE; i++) {
      row.push(items[i].shift()!)
    }
    puzzle.push(row.reverse().map(item => item?.split('')[0]))
  }

  puzzle.push([])
  puzzle.push([])

  return { puzzle, size: SIZE }
}

function reduceImage(imageData: ImageData, size: number): ImageData {
  return imageData
  const data = imageData.data

  let minX = null
  let maxX = null
  let minY = null
  let maxY = null
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const isBlack = data[(y * imageData.width + x) * 4] === 0
      if (isBlack) {
        minX = minX ? Math.min(minX, x) : x;
        maxX = maxX ? Math.max(maxX, x) : x;
        minY = minY ? Math.min(minY, y) : y;
        maxY = maxY ? Math.max(maxY, y) : y;
      }
    }
  }

  const width = maxX! - minX! + 10
  const height = maxY! - minY! + 10

  const scale = Math.max(width, height) / size

  const newWidth = Math.ceil(width / scale)
  const newHeight = Math.ceil(height / scale)

  const newData = new Uint8ClampedArray(newWidth * newHeight * 4)

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const newX = Math.floor(x * scale + minX!)
      const newY = Math.floor(y * scale + minY!)
      const isBlack = data[(newY * imageData.width + newX) * 4] === 0
      if (isBlack) {
        newData[(y * newWidth + x) * 4] = 0
        newData[(y * newWidth + x) * 4 + 1] = 0
        newData[(y * newWidth + x) * 4 + 2] = 0
        newData[(y * newWidth + x) * 4 + 3] = 255
      }
    }
  }

  return new ImageData(newData, newWidth, newHeight)
}

export default function Home() {
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const finalImageRef = useRef<HTMLImageElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState<string>('')
  const [puzzleJson, setPuzzleJson] = useState<string[][]>([])
  const [puzzleSolution, setPuzzleSolution] = useState<string[]>([])

  const handleFileSubmit = async () => {
    setText('')
    if (!file) return
    const base64 = await getBase64(file)

    const image = imageRef!.current!;

    image.onload = async () => {
      const scale = 400 / image.width
      const canvas = canvasRef!.current;
      const ctx = canvas!.getContext('2d')!;
      canvas!.width = image.width * scale;
      canvas!.height = image.height * scale;
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas!.width, canvas!.height);

      console.log("Removing background")
      removeBackground(imageData);

      console.log("Converting to white")
      convertCharToWhite(imageData);

      console.log("Inverting colors")
      invertColors(imageData);

      console.log("Removing puzzle containers")
      removePuzzleContainers(imageData);

      console.log("Reducing image")
      const newImageData = reduceImage(imageData, 200);
      canvas!.width = newImageData.width;
      canvas!.height = newImageData.height;
      ctx.putImageData(newImageData, 0, 0);

      console.log("Converting canvas to base64")
      const base64 = await getBase64FromCanvas(canvas!);

      console.log("Creating puzzle from image")
      const text = await createPuzzleWorker(base64)
      setText(text)

      console.log("Parsing puzzle text")
      const { puzzle, size } = await puzzleParser(text)
      setPuzzleJson(puzzle);

      console.log("Solving puzzle", puzzle)
      const puzzleSolver = new PuzzleSolver(size)
      const isPuzzleValid = puzzleSolver.validatePuzzle(puzzle)
      if (isPuzzleValid) {
        puzzleSolver.sortPuzzle(puzzle)
        setPuzzleSolution(puzzleSolver.steps)
      }
    }

    image!.src = base64;
  }


  return (
    <>
      <Head>
        <title>Ball Puzzle Solver</title>
        <meta name="description" content="Ball Puzzle Solver" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <input type="file" onChange={(e) => setFile(e.target.files![0])} />
        <button onClick={handleFileSubmit}>Submit</button>
        <div>
          <img ref={imageRef} style={{ display: 'none' }} />
          <canvas id="canvas" ref={canvasRef} />
          {/* <img ref={finalImageRef} /> */}
        </div>
      </div>
      <div>
        <h2>Text</h2>
        <div style={{ display: 'flex', gap: '20px', height: '300px', overflow: 'auto' }}>
          <textarea value={text} onChange={async (e) => {
            setText(e.target.value)
            const { puzzle, size } = await puzzleParser(e.target.value)
            setPuzzleJson(puzzle);
          }} />
          <pre>
            [<br />
            {puzzleJson.map((line, i) => `  ["${line.join('","')}"]`).join(',\n')}
            <br />]
          </pre>
          <pre>{puzzleSolution.map((line, i) => `[${line}]`).join(',\n')}</pre>
        </div>
        <button onClick={async () => {
          let _steps = puzzleSolution
          if (!puzzleSolution.length) {

            console.log("Validating puzzle", puzzleJson)
            const puzzleSolver = new PuzzleSolver(puzzleJson[0].length)
            const isPuzzleValid = puzzleSolver.validatePuzzle(puzzleJson)
            if (isPuzzleValid) {
              console.log("Solving puzzle", puzzleJson)
              puzzleSolver.sortPuzzle(puzzleJson)
              setPuzzleSolution(puzzleSolver.steps)
              _steps = puzzleSolver.steps
            }
          }

          for (const step of _steps) {
            // text to speech
            let stepName: number|string = parseInt(step.split('->')[0])
            const firstLineSize = Math.ceil(puzzleJson.length/2)
            const secondLine = "ABCDEFGHIJKLMNOPQRSTUVXYZ".split('')
            if(stepName > firstLineSize) stepName = secondLine[(Number(stepName)-1)%firstLineSize]
            const utterance = new SpeechSynthesisUtterance(String(stepName))
            utterance.lang = 'pt-BR';
            speechSynthesis.speak(utterance);
            await new Promise(resolve => setTimeout(resolve, 1000))
            // alert(step)
          }

        }}>Show Solution</button>
      </div>
    </>
  )
}
