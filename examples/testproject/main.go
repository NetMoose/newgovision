package main

import "fmt"

// --- ТЕСТ 1: ИНТЕРФЕЙСЫ (Interface) ---
// Ожидается CodeLens над Processor.
type Processor interface {
	Process(data string) bool
}

// --- ТЕСТ 2: СТРУКТУРЫ (Struct) ---
// Ожидается CodeLens над TextProcessor и NumberProcessor.
type TextProcessor struct {
	prefix string
}

type NumberProcessor struct{}

// --- ТЕСТ 3: МЕТОДЫ (Method) ---
// Ожидается CodeLens над обоими методами Process.
func (tp *TextProcessor) Process(data string) bool {
	fmt.Println(tp.prefix, data)
	return true
}

func (np NumberProcessor) Process(data string) bool {
	return len(data) > 0
}

// --- ТЕСТ 4: ОБЫЧНЫЕ ФУНКЦИИ (Function) ---
// Ожидается CodeLens над helperFunction (должен показать 4 ссылки).
func helperFunction(a, b int) int {
	return a + b
}

func main() {
	// Использование структур (создает references на TextProcessor и NumberProcessor)
	tp := &TextProcessor{prefix: "LOG: "}
	np := NumberProcessor{}

	// Использование интерфейса (создает references на Processor)
	var processors []Processor
	processors = append(processors, tp)
	processors = append(processors, np)

	// Использование методов через интерфейс и напрямую
	for _, p := range processors {
		p.Process("test data") // Reference на Processor.Process
	}
	tp.Process("direct call") // Reference на TextProcessor.Process

	// Множественные вызовы обычной функции
	_ = helperFunction(1, 2)
	_ = helperFunction(3, 4)
	_ = helperFunction(5, 6)
	_ = helperFunction(7, 8)
}
