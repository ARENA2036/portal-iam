/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ********************************************************************************/

const getNodeOrViewable = (c) => c.hasOwnProperty('view') ? c.view : c

const getTextNode = (c, tc) => document.createTextNode(tc === 'string' ? c : '' + c)

const append = (n, c) => {
    if (!(c instanceof Array)) c = [c]
    for (let i in c) {
        const tc = typeof c[i]
        if (tc !== 'undefined')
            try {
                n.appendChild(
                    tc === 'object'
                        ? getNodeOrViewable(c[i])
                        : getTextNode(c[i], tc)
                )
            } catch (e) {
                const pre = document.createElement('pre')
                pre.appendChild(document.createTextNode(JSON.stringify(c[i], null, 4)))
                n.appendChild(pre)
            }
    }
    return n
}

const N = (tag, c, att) => {
    const n = document.createElement(tag)
    if (att) for (let a of Object.keys(att)) n.setAttribute(a, att[a])
    if (typeof c === 'undefined' || c === null || c === false) return n
    return append(n, c)
}

const remove = (n) => {
    try {
        n.parentElement.removeChild(n)
    } catch (e) {
        // ignore
    }
    return n
}

const clear = (n) => {
    if (!n) return
    while (n.childNodes.length > 0) n.removeChild(n.firstChild)
    return n
}

const wrap = (c, p) => {
    const parent = c.parentElement
    parent.insertBefore(p, c)
    parent.removeChild(c)
    p.appendChild(c)
    return c
}

const addEvents = (node, evts) => {
    Object.keys(evts).forEach((key) => node.addEventListener(key, evts[key]))
    return node
}

class State {

    atts = {
        username: undefined,
        password: undefined,
        confirm: undefined,
        valid: [false],
    }

    listener = {
        username: [],
        password: [],
        confirm: [],
        valid: []
    }

    static getInstance() {
        return State.instance ?? (State.instance = new State())
    }

    addListener(att, listener) {
        if (Array.isArray(listener))
            this.listener[att].push(...listener)
        else
            this.listener[att].push(listener)
        return this
    }

    setValue(att, value) {
        if (this.atts[att] === value) {
            return
        }
        this.atts[att] = value
        this.listener[att].forEach((listener) => listener[`${att}Changed`](value))
        return this
    }

    addPasswordListener(listener) { this.addListener('password', listener) }

    addConfirmListener(listener) { this.addListener('confirm', listener) }

    addValidListener(listener) { this.addListener('valid', listener) }

    setUsername(value) { this.setValue('username', value) }

    setPassword(value) { this.setValue('password', value) }

    setConfirm(value) { this.setValue('confirm', value) }

    setValid(value) { this.setValue('valid', value) }

}

const Messages = {
    en: {
        OK_LENGTH: 'has a minimum length of 15 characters',
        HAS_LOWER: 'contains lower case characters [a-z]',
        HAS_UPPER: 'contains upper case characters [A-Z]',
        HAS_NUMBER: 'contains numbers [0-9]',
        HAS_SPECIAL: 'contains characters other than [a-z] [A-Z] [0-9]',
        OK_CONFIRM: 'confirmation and password are equal',
    }
}


class Validator {

    rules = [
        ['OK_LENGTH', /^.{15,200}$/],
        ['HAS_LOWER', /[a-z]/],
        ['HAS_UPPER', /[A-Z]/],
        ['HAS_NUMBER', /\d/],
        ['HAS_SPECIAL', /[^a-zA-Z0-9]/],
        ['OK_CONFIRM', (expr) => expr !== '' && expr === State.getInstance().atts.confirm],
    ]

    static getInstance() {
        return Validator.instance ?? (Validator.instance = new Validator())
    }

    constructor() {
        this.state = State.getInstance()
        this.state.addPasswordListener(this)
        this.state.addConfirmListener(this)
    }

    passwordChanged(value) {
        this.password = value
        this.checkValid()
    }

    confirmChanged(value) {
        this.confirm = value
        this.checkValid()
    }

    checkRule(rule) {
        const check = rule[1]
        if (check instanceof RegExp)
            return !!this.password.match(check)
        else if (check instanceof Function)
            return check(this.password)
        return false
    }

    checkValid() {
        this.state.setValid(
            this.rules.map(this.checkRule.bind(this))
        )
    }

}

class Viewable {

    constructor(view) {
        this.view = view
    }

    getView() {
        return this.view
    }

    append(c) {
        append(this.getView(), c)
        return this
    }

    appendTo(p) {
        append(p, this.getView())
        return this
    }

    detach() {
        remove(this.view)
        return this
    }

    clear() {
        clear(this.view)
        return this
    }

}

class Card extends Viewable {

    constructor(name) {
        super(
            addEvents(
                N('div',
                    [
                        N('div',
                            N('div', 'switch company', { class: 'switch' }),
                            { class: 'overlay' }
                        ),
                        N('div', null, { class: 'card-image' }),
                        N('div', name, { class: 'card-name' }),
                    ], { class: 'card' }
                ),
                {
                    click: (e) => {
                        e.preventDefault()
                        history.back()
                    }
                }
            )
        )
    }

}

class Form extends Viewable {

    static fromPage() {
        try {
            const form = document.getElementsByTagName('form').item(0)
            switch (form.id) {
                case 'kc-form-login': return new FormLogin(form)
                case 'kc-passwd-update-form': return new FormUpdate(form)
                case 'kc-reset-passwd-form': return new FormReset(form)
            }
        } catch (e) {
            return null
        }
    }

    constructor(form) {
        super(form)
    }

    appendPasswordButton(password) {
        const toggle = addEvents(
            N('div', null, { class: 'hidden' }),
            {
                click: ((e) => {
                    e.preventDefault()
                    const input = e.currentTarget.previousSibling
                    const isHidden = input.getAttribute('type') === 'password'
                    input.setAttribute('type', isHidden ? 'text' : 'password')
                    e.currentTarget.className = isHidden ? 'visible' : 'hidden'
                })
            }
        )
        const wrapper = N('div', null, { class: 'pwwrapper' })
        wrap(password, wrapper)
        wrapper.appendChild(toggle)
        return this
    }

}

class FormLogin extends Form {

    constructor(form) {
        super(
            N('div', [
                N('h3', 'Register to Catena-X'),
                N('p', 'Finish the company registration form to join Catena-X automotive network. Please use your email address as username and enter your password.'),
                form
            ])
        )
        setTimeout((() => {
            this.appendPasswordButton(document.getElementById('username'))
            this.appendPasswordButton(document.getElementById('password'))
            document.getElementById('username').focus()
        }), 300)
    }

}

class PasswordPolicyHint extends Viewable {

    constructor() {
        super(
            N('ul', null, { class: 'password-policy-hint' })
        )
        this.hints = Validator.getInstance().rules.map(rule => N('li', Messages.en[rule[0]]))
        this.append(this.hints)
        State.getInstance().addValidListener(this)
    }

    validChanged(valid) {
        valid.forEach((v, i) => this.hints[i].className = v ? 'valid' : 'invalid')
    }

}

class FormUpdate extends Form {

    constructor(form) {
        super(
            N('div', [
                N('h3', 'Update your password'),
                N('p', 'Enter a new login password and confirm it.'),
                form
            ])
        )
        this.form = form
        State.getInstance().addValidListener(this)

        setTimeout((() => {
            const password = document.getElementById('password-new')
            this.setItems()
                .appendPasswordButton(
                    addEvents(
                        password,
                        {
                            'keyup': (e) => this.checkPolicy('password', e.currentTarget.value),
                            'focus': (e) => this.checkPolicy('password', e.currentTarget.value),
                        }
                    )
                )
                .appendPasswordButton(
                    addEvents(
                        document.getElementById('password-confirm'),
                        {
                            'keyup': (e) => this.checkPolicy('confirm', e.currentTarget.value),
                            'focus': (e) => this.checkPolicy('confirm', e.currentTarget.value),
                        }
                    )
                )
            password.focus()
        }), 300)
    }

    setItems() {
        const items = [...document.querySelectorAll('#kc-passwd-update-form>div')]
        this.section = {
            password: items[0],
            confirm: items[1],
            submit: items[2],
            policy: new PasswordPolicyHint().getView(),
        }
        this.button = document.querySelectorAll('input[type=submit]')[0]
        this.button.setAttribute('disabled', '')
        State.getInstance().setUsername(document.getElementById('username')?.value ?? '')
        Validator.getInstance()
        return this
    }

    checkPolicy(att, value) {
        this.form.insertBefore(remove(this.section.policy), this.section.submit)
        State.getInstance().setValue(att, value)
    }

    validChanged(valid) {
        if (valid.reduce((a, o) => a && o))
            this.button.removeAttribute('disabled')
        else
            this.button.setAttribute('disabled', '')
    }

}

class FormReset extends Form {

    constructor(form) {
        super(
            N('div', [
                N('h3', 'Reset your password'),
                N('p', 'Enter your username or email address.'),
                form
            ])
        )
    }

}

class Section extends Viewable {

    constructor() {
        super(
            N('section',
                N('div', [
                    N('div', null, { class: 'user-icon' }),
                ], { class: 'section-header' })
            )
        )
    }

}

class App extends Viewable {

    constructor(clear) {
        super(document.body)
        this.setIcon()
        if (clear)
            this.clear()
    }

    setIcon() {
        let icon = document.querySelectorAll('link[rel=icon]')[0]
        if (!icon) {
            icon = document.createElement('link')
            icon.rel = 'icon'
            document.head.appendChild(icon)
        }
        icon.href = 'data:image/png;base64,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'
        return this
    }

}

class Header extends Viewable {

    constructor(title) {
        super(
            N('header')
        )
    }

}

class Main extends Viewable {

    constructor() {
        super(N('main'))
    }

}

class Footer extends Viewable {

    constructor() {
        super(
            N('footer', [
                N('div', '', { class: 'links' }),
                N('div', 'Copyright © Catena-X Automotive Network.', { class: 'copy' })
            ])
        )
    }

}

addEvents(
    window,
    {
        load: () => {
            const title = document.getElementsByTagName('h1').item(0).firstChild.data
            const content = document.getElementById('kc-content')
            const form = Form.fromPage()
            new App(true)
                .append(new Header(title))
                .append(
                    new Main().append(
                        new Section()
                            .append(form || content)
                    )
                )
                .append(new Footer())
        }
    }
)
