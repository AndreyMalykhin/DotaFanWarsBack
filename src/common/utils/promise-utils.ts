export function forEach<T, R>(
    elements: T[],
    processor: (element: T, index: number) => Promise<R>,
    result?: R,
    currentIndex = 0
): Promise<R> {
    if (currentIndex >= elements.length) {
        return Promise.resolve(result);
    }

    return processor(elements[currentIndex], currentIndex)
        .then(function(result) {
            return forEach(elements, processor, result, ++currentIndex);
        });
}
