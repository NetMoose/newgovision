.PHONY: install compile lint package clean

install:
	npm install

compile:
	npm run compile

lint:
	npm run lint

package: compile
	npx vsce package --no-rewrite-relative-links

clean:
	rm -rf out/
	rm -f *.vsix
	rm -rf node_modules/
