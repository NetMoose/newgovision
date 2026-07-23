package main

import "fmt"

// --- ТЕСТ 1: ИНТЕРФЕЙСЫ (Interface) ---
// Ожидается CodeLens над Processor и Closer.
type Processor interface {
	Process(data string) bool
}

type Closer interface {
	Close() error
}

// --- ТЕСТ 2: СТРУКТУРЫ (Struct) ---
// Ожидается CodeLens над TextProcessor и NumberProcessor.
type TextProcessor struct {
	prefix string
}

type NumberProcessor struct{}

// --- ТЕСТ 3: МЕТОДЫ (Method) ---
func (tp *TextProcessor) Process(data string) bool {
	fmt.Println(tp.prefix, data)
	return true
}

func (tp *TextProcessor) Close() error {
	fmt.Println(tp.prefix, "closing")
	return nil
}

func (np NumberProcessor) Process(data string) bool {
	return len(data) > 0
}

// --- ТЕСТ 4: ОБЫЧНЫЕ ФУНКЦИИ (Function) ---
func helperFunction(a, b int) int {
	return a + b
}

func main() {
	tp := &TextProcessor{prefix: "LOG: "}
	np := NumberProcessor{}

	// Использование интерфейса Processor
	var processors []Processor
	processors = append(processors, tp)
	processors = append(processors, np)

	// Использование интерфейса Closer
	var closers []Closer
	closers = append(closers, tp)

	for _, p := range processors {
		p.Process("test data")
	}
	
	for _, c := range closers {
		c.Close()
	}

	tp.Process("direct call")

	_ = helperFunction(1, 2)
	_ = helperFunction(1, 3)
	_ = helperFunction(1, 4)
	_ = helperFunction(1, 5)
}
