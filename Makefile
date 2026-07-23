VERSION ?= 1.0.1

.PHONY: install compile lint package clean

install:
	npm install

compile:
	npm run compile

lint:
	npm run lint

package: compile
	npm version $(VERSION) --allow-same-version --no-git-tag-version
	npx vsce package

clean:
	rm -rf out/
	rm -f *.vsix
	rm -rf node_modules/
