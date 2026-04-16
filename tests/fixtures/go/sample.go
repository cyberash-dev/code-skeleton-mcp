// Package sample demonstrates outline extraction.
package sample

import (
	"fmt"
	stdlog "log"
	"net/http"

	"example.com/pkg/util"
)

// MaxRetries is the default retry cap.
const MaxRetries = 3

var defaultTimeout = 30

// User is a user record.
type User struct {
	Name string
	age  int
}

// Greeter is a thing that greets.
type Greeter interface {
	Greet() string
}

type UserID = int

// NewUser constructs a User.
func NewUser(name string) *User {
	return &User{Name: name}
}

// Greet returns a greeting.
func (u *User) Greet() string {
	return fmt.Sprintf("hi, %s", u.Name)
}

func (u *User) privateHelper() int {
	_ = stdlog.Ldate
	_ = http.StatusOK
	_ = util.Noop
	return u.age
}
