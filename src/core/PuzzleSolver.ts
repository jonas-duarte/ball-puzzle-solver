export class PuzzleSolver {
    private size: number;
    public steps: string[];

    constructor(size: number) {
        this.size = size;
        this.steps = [];
    }

    private _findDestinies(puzzle: string[][], originIndex: number): number[] {
        const originColor = puzzle[originIndex][puzzle[originIndex].length - 1];
        const quantity = this._countLastColor(puzzle[originIndex]);
        if (originColor === undefined) {
            return [];
        }
        const destinies: number[] = [];
        for (let i = 0; i < puzzle.length; i++) {
            if (i === originIndex) {
                continue;
            }

            const row = puzzle[i];
            if (row.length === 0) {
                if (puzzle[originIndex].every((color) => color === originColor)) {
                    continue;
                }
                destinies.push(i);
                continue;
            }
            if (row.length + quantity > this.size) {
                continue;
            }

            const lastColor = row[row.length - 1];
            if (lastColor === originColor) {
                destinies.push(i);
            }
        }
        return destinies;
    }

    private _clonePuzzle(puzzle: string[][]): string[][] {
        return puzzle.map((row) => [...row]);
    }

    private _isResolved(puzzle: string[][]): boolean {
        return puzzle.every(
            (row) =>
                (row.length === 0 || row.length === this.size) &&
                row.every((color) => color === row[0])
        );
    }

    private _countLastColor(row: string[]): number {
        const lastColor = row[row.length - 1];
        for (let i = row.length - 1; i >= 0; i--) {
            if (row[i] !== lastColor) {
                return row.length - i - 1;
            }
        }
        return row.length;
    }

    public validatePuzzle(puzzle: string[][]): boolean {
        const map = new Map<string, number>();

        const values = puzzle.flat();

        for (let i = 0; i < values.length; i++) {
            const color = values[i];
            if (color === undefined) {
                continue;
            }
            if (!map.has(color)) {
                map.set(color, 0);
            }
            map.set(color, map.get(color)! + 1);
        }

        // @ts-ignore
        for (const [key, value] of map.entries()) {
            if (value !== this.size) {
                console.log(`Color ${key} has ${value} elements`);
                return false;
            }
        }

        return true;        
    }

    public sortPuzzle(puzzle: string[][], steps: string[] = []): boolean {
        if (steps.length > 100) {
            return false;
        }
        for (let i = 0; i < puzzle.length; i++) {
            const row = puzzle[i];
            const destinies = this._findDestinies(puzzle, i);
            if (destinies.length === 0) {
                continue;
            }

            for (let j = 0; j < destinies.length; j++) {
                const destinyIndex = destinies[j];
                const destinyRow = puzzle[destinyIndex];
                const originColor = row[row.length - 1];
                const destinyColor = destinyRow[destinyRow.length - 1];
                if (destinyColor && originColor !== destinyColor) {
                    continue;
                }

                const newPuzzle = this._clonePuzzle(puzzle);
                while (newPuzzle[i][newPuzzle[i].length - 1] === originColor) {
                    newPuzzle[destinyIndex].push(originColor);
                    newPuzzle[i].pop();
                }
                const _steps = [...steps, `${i + 1}->${destinyIndex + 1}`];
                const _isResolved = this.sortPuzzle(newPuzzle, _steps);
                if (_isResolved) return true;
                if (this._isResolved(newPuzzle)) {
                    this.steps = _steps;
                    return true;
                }
            }
        }
        return false;
    }
}
