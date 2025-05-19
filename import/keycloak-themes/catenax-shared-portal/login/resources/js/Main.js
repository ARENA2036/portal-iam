/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
                    //document.getElementById('password').focus()
                }).bind(this)
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
        super(form)
        this.adjustSequence()
        setTimeout((() => {
            this.appendPasswordButton(document.getElementById('username'))
            this.appendPasswordButton(document.getElementById('password'))
            document.getElementById('username').focus()
        }).bind(this), 300)
    }

    adjustSequence() {
        const forgot = [...this.view.children][2]
        this.view.removeChild(forgot)
        this.view.appendChild(forgot)
        const links = [...forgot.getElementsByTagName('a')]
        if (links.length === 0)
            return
        const parent = links[links.length - 1].parentElement
        parent.appendChild(
            addEvents(
                N('a', 'Sign in with another company', { href: '#' }),
                {
                    click: (e) => {
                        e.preventDefault()
                        history.back()
                    }
                }
            )
        )
        return this
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
        super(form)

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
        }).bind(this), 300)
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
        this.getView().insertBefore(remove(this.section.policy), this.section.submit)
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
        super(form)
    }

}

class Section extends Viewable {

    constructor() {
        super(N('section'))
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
            N('header', [
                N('h3', title)
            ])
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
            const realm = document.getElementById('kc-header-wrapper').firstChild.data
            const content = document.getElementById('kc-content')
            const form = Form.fromPage()
            new App(true)
                .append(new Header(title).append(content))
                .append(
                    new Main().append(
                        new Section()
                            .append(new Card(realm))
                            .append(form || content)
                    )
                )
                .append(new Footer())
        }
    }
)
