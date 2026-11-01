.PHONY: build test test-npm release soak check run

build:
	./bootstrap.sh build

test:
	./bootstrap.sh test

test-npm:
	./bootstrap.sh test-npm

release:
	./bootstrap.sh release

soak:
	./bootstrap.sh soak

check: test

run:
	./target/native/jsrt --help
