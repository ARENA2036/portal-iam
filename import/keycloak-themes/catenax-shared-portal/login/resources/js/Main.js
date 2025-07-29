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
        icon.href = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDUwMyAzMDIiIHdpZHRoPSI1MDMiIGhlaWdodD0iMzAyIj4KCTx0aXRsZT5OZXcgUHJvamVjdDwvdGl0bGU+Cgk8ZGVmcz4KCQk8aW1hZ2UgIHdpZHRoPSI1MDMiIGhlaWdodD0iMzAyIiBpZD0iaW1nMSIgaHJlZj0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFmY0FBQUV1Q0FZQUFBQ1RSRnZBQUFBQUFYTlNSMElCMmNrc2Z3QUFLbmhKUkVGVWVKenRuZjkzVlBXZC95OXdJSE52SW9nbHpoMGdycHhTWmlhQVVqVmFZV1lpdHBTNlJUN3R1dWwyTGF1eUpoT2xmc1B2Vm9HWk82QjFXOWtXMi8xOFBIeU8rNFBIMC9QaDQvbDhEc2NmeXZiVFJWUzB1MkJOV1VVWHFVR1N6Q1FFa2p1VFFENDVPVW5tYzI4U1BINVVZSkxNdkY3dm1kZnpjYzdqTCtCOTc1T1pQT1plVFFQeUNFYXZPaGFhKzcrVFlUTUxSWG02UFd4V2N4OC9RRWZyZGsyM0xlTncydEt6VUpTN3VNOGVvQ1o0NTE5b2dlaEovNUlmTnJlRWZCMEtEQTZrdGZsNDZMTFozTWNRMEpDeDlOMEtEQTJrTktFM1pYZG9aZHhuRDFCU3ZhSENHZmJEamxuWFJZdi85bGhiMk94UllIQWdxZDc5NzF5dFRlYytqcUN3T0ovWTQreERBMG0xTFQxMVpwdmg0ejU3Z0pZcFdxQnh6OWxoUCt1M3IxejdKK2VHUDhnL09KRFN0ckQzSmU0RENRcUhuVERXY2c4TkpMZmZqcFV2NHo1N2dCcC85Tm5QRC90Wkg3eXE5azN1c1lFTUF4OHhIK0krbGlEL3VEZDQ1MGJmcDhEWVFFcmplaDMzMlFQVStCdlhuV3ZZei9xYmE1ZnU0eDRiU081UUt1eGJ6WDA4UWY3b2ZicWkwdjFxbG4xb0lLbTJaU1M0eng2Z1psRkRqVFBlQXhjYTl5bUI2UERCRlFzT0tEQTRrTlplRlBTbGdSdFJPVGY2QTl4REEybDFvOGxzVnB2Q2ZmNEFKVXMyVkRuRDNYbWhZVCtySjFqZjkrZlF2Q01LREE2a3RRVUZmZkhqM09oM2NROE5wTlg5bWFQN2MwZnVzd2NvK1Z3Wm42dG05VzBuV3NPK0V3b01EaVFWQlgweGswN29qM0FQRFNTM3MydXJYc1Y5OWdBdFgxckc1K3F5eFhYdXAvYysvc0dCbEtLZ0wwNHk4ZkxWem8xK1NJR3hnWFFPWkN5amh2dnNBV3I4RFQrZDZMQ2Y5UWZMYm5MLy9qN01QVGlRZU9CUjBCY1ZQYkd5UmM2TnZsZUJzWUdFWml6UE91NnpCNmpKb1l6UDFlMDExNktnbHljSytpSWgvY3lzMmM2TnZwbDdhQ0M1ejNLZlBVQk5qbVg4ZU55M2ZORmJDZ3dPcEJVRnZlSmtkMm5UYkV2ZnI4RFFRRkk5ZTFER1MyT2NaWHl1VGcvVUQzd1lxbnBQZ2NHQnRLS2dWeGpuSnIrVGYyZ2dwVzRaM3huVEtyalBIcUJrZ21WOHJsNGN2TU0rSHZhMUtqQTRrRlFVOUNxU1RoaDNjdzhOSkxjYlpidzhKbFhHNXlwZU1pTlRGUFJxMFdQcEs1d2IvYUFDWXdQcEhIRC8zYm5QSHFBbUQyVjhycm92bVVtRnpRSHV3WUhFUnN5SHVZODVjRCt4ZXhhNG4rQVVHQnRJS01wNGlmaWpkVlREZnRhN3I3b1JnWjA4VWRBejQvNnQxYm5SSCtFZUdrZzk3UG8vY3A4OVFNMW9HZDlQUGU2dUwxOTdCWDRpSjA4VTlFeGtZOXBVdDVMbUhocEk3bDczMzU3Ny9BRktDbFRHNXlwZU1pTldGUFFNT0ovZW5sTmdhQ0N0UjdwaTJrenVzd2NvbWI5UmR3YjJFTmV3bjFVUDNua0dMNW1ScUhjLzl5VWdDVHZ1V2EvQTBFQmF1OTIrZ3Z2c0FWcW1PTU82bTN2WXoxcTFlRjJ5TmV3N3hUODRrRklVOURUWWxxYzJqVEplbW9NbzR5VVNpRDdEUGVpZmQvblN2M29mQmIxQVVkQVhsRXlpN0d0cHk4Z29NRGFRVktPZSsrd0JhaGpLK0Z5OS82b2IzbVFmRzBndEN2b0NNZmJNK0dQOFF3TXB0ZVA2cjdqUEhxQ0dzWXpQMWQ5Y3V4UUZ2VHhSME9lWjdBdmFkT2RHL3piMzBFQnk5N3J2QytBK2Y0QVM1akkrVjZjR0dvWU9yZmlMZHhVWUhFZ3JDdm84NHR6a1gxWmdhQ0N0elNqanBURmF4aGZzbWZINWRtWndmZVpZYUc2ekFvTURTY1V6NlBOQk9xRS9vc0RRUUZLTlRFK3NiQkgzMlFPMEtGWEc1K3BYRjkvYTBobzJNL3lEQXlsRlFUODVlaExHR3VkbVA4dy9OcERRSVR2dVdjbDk5Z0ExQ3BieHVicm15cHZkcitjSHVRY0hrdnNJOTJWVGpIVEh5cTl3YnZSOUNvd05KRFJqNmZkeG56MUFqY0psZks3R3Ixbit1Z0pqQTJrZFJrRS9QazdIeWszblJ0L09QVFNRVnR2UzhVMlhPSXFnak0vVjN5OWZoSi9JeVJNRmZZNjBidGYwZEVJL3hEMDBrSHpZOTd1L2l1QStmNENTSWluamMzVjZvSDdnZzFEVklRVUdCOUxhNGd4OEpmZmxwRExackRiRnVjbS95ajAwa054bTl6a0czT2NQVUZKa1pYeXV6cTYrbzdzbGJDWVZHQnhJYUZ2WVBJQ0MvdHlrNDhiVENnd05wTFVYWmJ3OGlyS016OVVybC96Z3FIT3pQODA5T0pCNjRGSFFmeGtaeTNPckFrTURhUjNLeE12Um80Z2owUGcwOXdBWDJyOWE5cGNIblJ2K01QZmdRSElmNWI2OFZLTEgwcTkzYnZRRENvd05wQlh2WWhCSENaVHh1YnFqcHVZMUJjWUcwb3FDZmd3NzVyazg3YjdPazM5b0lLRW80eVZTUW1WOHJyNnhmT0hiQ2d3T3BGVjhRZTgrWHRTNTBYL0VQVFNRM0FNbzQ2VlJZbVY4cnM0STF2Y2ZEYzM3VUlIQmdiU0tMdWpUbHZFN0JZWUcwdHJTRTd0b0R2ZlpBNVJjSFRXY29UdkVQYlJjbXRXM25XZ04rMDRvTURpUVZOOWIzSmNlQittRThhSUNRd05wN2V1TnpSRDliWlZFU3JxTXo5V2FwWC90Zm5ydjV4OGNTS20wZ3Q1TzZQY3JNRFNRMW1FN1lhemxQbnVBR2dGbGZLN2VmZFdOYjNHUERXUlJSRUdmanBldGNtNzBRd3FNRFNUVjh4UHVzd2VvRVZURzUrci8vTWFTZlFxTURhUzE1QXY2M3NTTW9IT2pQODAvTkpEWVhkeG5EMUFqc0l6UHhXbUJoc0gzVjFUOVNZSEJnYlNXYkVIdlJsVE9UYjVWZ2FHQnRCN0k3dERLdU04Zm9FUm9HWityN2lOcWorTVJ0Ukl0dVlMZXZibW40L3BCQllZR0VtcGJlcXIzNllxU09zdmdRcFRvTStQejdaVkwvdVlqNTJaL1JvSEJnWVNXMmpQb25SdjlLOXhEQThudHMyUGx5N2pQSHFBRlpmdzR2TzNyMy80RDk5aEFqb0V2allMZXRveUVBa01EaVVVWkw1RkFkQnYzWUJhYkw5WXNlNDE3YkNDRElmTXg3c3QxTXFUaitpM2NJd1BwelNROFc3alBIcUFHWmZ5RW5CS0lEdjl4eFlJRDdHTURxUzNhZ243c1pURDkzRU1EaVlmZDBuZHpuejFBRGNyNFNWa2UvUHZUeDBMelBsWmdjQ0N0UlZmUTQyVXdRazNvVGEzYk5aMzcvQUZLZ2xHZmhqSiswaTVjZk92eDFyQ1pVV0J3SUsxRlU5RGpaVEJpN1R5enpmQnhuejlBaVZ2Rys2Tk4zTU5ZS3E2NWNzMGZuWnY5a0FLREF3a3Rob0krdTB1YjV0ems5eWt3TkpEVy9veGwxSENmUDBBTHl2Z0N1TDNtV2p6QlRxQ3FGL1I0R1l4UTQzb2Q5OWtEMUtDTUw1aC9XUDVWL0VST29vb1c5QmxMdjQ5OVpDQ0R4amJ1c3dlb1FSbGZVUFhnbldjK0RzMzdpSDFzSUxYS0ZmUjRHWXhNM1RJK205V21jSjgvUUFuS2VCSXZXN3d1MlJZMnV4VVlIRWlyTWdVOVhnWWpVOXN5RHFPTWx3YktlRksvZWVWYTl3VXpnd29NRHFTVnZhREh5MkRFMnRtMVZhL2lQSHVBR3BUeExHNitac1hyQ293TkpOWXQ2SS9ldEpEdGpWdk9UZjZBQWtNRGlYVWZVTVIxNWdBWGdjYi94VDEwVXQxenZmOE43ckdCRElaOEwzTmM2bW04REVha0djdXpqdU84QVU2QzBhM2NBeWRaOXgzd0g0U3Evb045YkNDNXFZajNjY3BMM2JuQmIrWWVHY2hnWFA4SHluTUdWQUJsdkJKZUhMekRQaDcydFhDUERTUjNPQm54a3J5RkN5K0RrYXBuVHphbVRhVTRZMEFWVU1ZcnBYL3gzeDVyQzVzOUNnd09wTFd2MEFWOWVxdHhUUm92Z3hHblc4WjN4clNLUXA0dG9Cb280NVYwOVpWcm01SW82Q1Zhc0lMK2RLemNkRzcwSjdtSEJwTGJqVEplR2lqamxYWUxDbnFSRnFLZ2QzL1BuRTdvaHhRWUdranJRSStscjhqbldRTHFnMmZHRjRHL1JVRXYwbFRFM0pXdkM5MTlBcGx0NmE4cU1EU1FXSlR4RWtFWlh4UzZCZjE3S3k1cjRoNGJ5REh3K1Nub25adjhzOXdqQXhtR1BhNy9JaC9uQnhRVEtPT0x5b3VDNjN1T3JaaDdqSHRzSUxtVEx1aWRUMjYzY284TVpIRXZ5bmhwb0l3dlNoY3MvbEZMVzlockt6QTRrTllKRi9UdVU4aWNtL3lBQWtNRGFUM1NGZE5tNW5zNmdNcWdqQzlxYjdqaWUrNERibERReTNQY0JiMGQ4MXp1M09TN0ZSZ2FTS3FSU1NjOEN3bzFJVUJGVU1hWGhJOWVIVUZnSjlEeEZQVHVwemJuUnY4Ui85QkFZZ2Z0dUdkbG9hY0VxQVhLK0JMeWYzeGp5VDd1c1lIMDVsTFF1MzluZFc3eSt4UVlHa2hzeGpJMlVJd0pVSWxnUTRKN2tHRCtuQnBvR0dwYWNmazczR01ER1FZKzdIM2lmSmU2YmVuUGM0OE01TkN6azJwT2dDcWdqQzlKeTROL2YvcFlhTzZmdWNjR2tudk9ndDZPZTliemp3eGtjRzkybHphTmVsb0FKeWpqUzlxcXhldVNLT2hGK29XQzNyWTh0YzVOZmxDQm9ZRzBOcU9NbHdiS2VCRzZCWDBxYkE0b01EaVExazhMK2t5aTdHc2psVFQvMEVCU2pVeFByR3dSOTlRQVNsREdpL0xIWDErNVg0R3hnY1M2QmIzOXdNVVhPemY2WS94REE0a2RRaGt2a1VEMEZlN0JnYlQrNXRxbHYrVWVHMGh2OThhTFhsTmdhQ0N4R1V1L2ozdG1BRFVvNHlYYXJmbnJGeVJENW1QY1l3UHA3THg5OW43dWtZSDAycGIrRXZmTUFHcFF4a3QwUVBQZjlla3JIZHZDNWlidTBZR0Z0MlB0SFB5V1hhRE9zTy9QdnFCTjU1d1pRQTNLZUpuNkc3L3dTa2YzWVNmYzR3TUxaK3BHNzUvU2NYMkllMmdndVMzcFoyYk41cGdYd0FYS2VLbHUvN0xqNEQ2bU5Cbng0ald4cFdpdGVjemVyUGNvTURTUTF0N2UySXdKdlVBSUZDc280NFhhdUVmVFl1ZDhwZU1uNFRtK1ZOaE1zWThSektOZXUvdng4bFlGaGdiU09weUpsNittbkJXZ0FuaG12RVNQYU5VYktpNTBOTnFXejF2bWpFSS8veWpCUERqWWRmOUY3eWt3TkpEYWhQNEl4WlFBbGZCSExRV0dCdEk2VXNibmVrVGFRbWFkQXNNRUorbkoyeTkrazMxa0lMa280eVdDTWw2aWc1OHQ0M1BGR1ljNDl6akJpWXN5WHF3SFVNWkxvN3BobVlZeVhwN0JhUDFFajR3ekVydTVSd3FPWDVUeFltM3BmYnFpTXArekFWUm50SXhQc1E4TkpCNzJ4bDlNNXRpMFhqOWZSMEZmWktLTWwyb2Z5bmhwb0l5WDZ0N3psZkc1NGhiMHptaDBzbzhXekVHVThVSWR0aFBHbDc3U0Y1UXlLT01sZWtSYmVHL2VYdW5ZWG12V0pGSFFxeTdLZUtrbVBFL202MW9IeFFMS2VJbU9xNHpQRlJUMGFvc3lYcXk3OG4ydEE5VkJHUy9SQ1pYeHVkSVc5bTNqSGpINFJWSEdDeldoTjJWM2FHV0Z1dDZCaXFDTWwra2t5dmhjeUdyYWxDUUtlcVZFR1M5VDI5SlRaN1ladmtKZTcwQTFVTVlMdFdFSHhmRWFLZWpENW1IdVVZTW15bmk1OXRteDhtVVUxenRRQlpUeFVzMUxHWjhyeWNqY3FpUUtlbVpSeGtzVlpieEVVTVpMTks5bGZLNjRCWDBxYkE3d2o1eElVY1lMMWJhTU9QVzFEcmdKTk1ZVkdCcElhNllRWlh5dXBNSytkUW9NblRoUnhzczBZK203dWE1MXdBWEtlSWtPT3YvdUs3bVBuak0yejNLUG5TUlJ4Z3Mxb1RlMWJ0ZDA3dXNkVUlJeVhxWUZMdU56WmF5ZzM4TTllaEpFR1MvV1RwVHgwa0FaTDlYbnVZL2VaK204b2JJaWlZSytzS0tNbDJwL3hqSnF1Szl4UUFuS2VLbnUxYlM2YWR6SDcvT01GZlRkN0NOWWtxS01GMnRjcitPK3RnRTFLT01seWxMRzUwb3lQSGNGQ3ZxOGl6SmVxbkhqYWU1ckdsQ0RNbDZpckdWOHJxQ2d6NjhvNDZYcTJaUE5hbE80cjJkQUNjcDRpU3BSeHVlSzgrbjlPZTVSTEFWUnhzdlV0b3pEblRHdGd2czZCcFNnakplcEltVjhybVExYldvU0JmMmtSQmt2MXM2dXJYb1Y5elVNS0VFWkwxTi80Nis1ajk1RUdDdm9qM0NQWkZHS01sNnFBeWpqcFlFeVhxcEtsdkc1MGhIeExraWlvQituS09PbG1yRTg2N2l2V1VBTnluaUpOcXRjeHVlS1c5QTdvelhJUDVwRkljcDRxY2IxbjNOZnE0Q2FRRFNtd05CQVdqTmFvR0VSOTlITEY4Nm4wWG9GaGxONVVjWkwxYk1uRzlQSTN1b0lWQUJsdkVTTHFvelBGV2U4ZG5DUHA4cWlqQmZyRVpUeDBrQVpMOVY3dUk5ZUlYQUwrbFRJM01zOW9pcUtNbDZzM2VtRVIvbG5WNEI4Z2pKZXB2N29UdTZqVjBpNnJydGtaaElGL2Y4dnluaXBEdlpZK2dydWF4SlFnakplcWtWZHh1ZktXRUdmWVI5VkpVUVpMMWVqcUo1ZEFmSUJ5bmlKbGtRWm55dHR0ZWJLSkFwNmxQRkN0UzM5bDl6WElLQUdaYnhFUzZxTXo1Vmt5Tnlnd01DeWlUSmVySHRSeGt2RDM3QldnYUdCdEE2VllobWZLNm13K1YrNVI1WkRsUEZpUGRJVjA4UjhRd2RjUnN2NFBnWEdCcExhZUMvMzBlTWtXNmROazFiUW80eVhxcEZCR1M4TmxQRXlMZkV5UGxkRUZmUW80NlU2YU1jOVlyK2hrOG5DZTh0UXhrdTBZYitFTWo1WFpCVDBLT09sbXJIMGtueDJCVGdmd2VndS9xR0J4RFpyUysrZXpYMzBWS1BFQzNxVThXTDE0QnM2Y1FTaVd4UVlHa2lyeURJK1YwcjFHZlFvNDJWcVcvcis3QzROMzlDSkFtVzhSRVdYOGJtU0xMRm4wSjlZTytkMTdwR0JMRGFubjVtRmIraEVnVEplcHY2Rys3bVBYakZRU3MrZ1J4a3YxdDZlV0JtK29STUZ5bmlab293ZkZ5VlIwS09NbCtwUUpsNittdnNhQXBTZ2pCY3F5dmlKTUZiUWQ3T1A5TVRzUVJrdlV6dWhiK1MrZGdBMUtPTWxpakorRWlURGMxZWt3dWFBQW1NOUhnZTc3cjNvVDl3akF4bUczZEpmNHI1bUFEVW80eVhhaXpKKzhxVEN2blVLREhiT29veVg2VWdaLzRJMm5mdDZBWlNnakpmb2tEUHMrTHRibm5BK3ZUL0hQZHE1ZU9KbWxQRkNiVUVaTHcyVThUSU5SaC9nUG5xbGhGdlFPK081aDN1OHorZFlHVCtvd05CQVdudDdZek9xdWE4UlFBbktlSmtHby9pN1d3SG92S0d5d2huUnc5d2ovcVdpakpmcU1NcDRhYUNNRjJyRGZ1M3FLUDd1VmlDU2tibFZTZlVLZXBUeFVrM29qM0ZmRTRBYWxQRVNSUmxQZ0dJRlBjcDR1ZTdpdmhZQU5ZR0d6UW9NRGFRVlpUd2hxaFQwS09QRmVpQzdReXZqdmc0QUpTampKWW95bmdGblhKL2xIUGFPbStmc1UyQmtJTDB0dlU5WFZIS2ZmMEFKeW5paE5qN0lmZlFra3RXMEtVbW1naDVsdkZqN1VNWkxBMlc4VEZIR3M4SlMwS09NbCtxd25URFdjcDk1UUFuS2VLR2lqRmVCc1lLK2syamNVY1lMTldONW51SSs2NEFhbFBIeTlFZGJVTWFyUTN1dFdlTU1iMytCaHgxbHZGeFJ4b3NEWmJ4RWU3WHFSdnpkVFRIYVFtWmRJY2NkWmJ4UUUzb1R5bmhwb0l5WEtNcDRoV2tMKzdZVll0aFAzRnlKWjhZTDFMYjAxSmx0aG8vN1hBTktVTVlMdGVGaDdxTUh6czFZUWI4N244T09NbDZzL1hhc2ZCbjNtUWFVb0l5WEtjcjRvcUQxK3ZsNk11SnR5c3U0bzR5WGExeXY0ejdMZ0JLVThVSkZHVjlNZkJLZTQwdE92cUJIR1M5VU8yNVkzR2NZVUlNeVhwNG80NHVTU1JiMEtPT0ZtckgwM2Rtc05vWDcvQUpLZ3RGTjdFTURxVVVaWDhSTXRLRHZYRGNiQVoxRUUzcFQ2M1pONXo2M2dCS1U4UklkUmhsZi9EaGpIUi9Qc0xkL3R4SS9lWk5wSjhwNGFhQ01sNmsvK2dqMzBRUDVJUlV4ZDZHTWgrZXhQMk1aTmR6bkZGQ3ljSDJsaGpKZW5pampTNHFqTnkwc3UyQkJIekZiVWNZTEZXVzhNTnd5UGhBOXdENDBrTm9ES09OTEQ3ZWdUNFhOMURuTCtNZktqN0dQRE9RWTlwOXluMDFBRGNwNGVicGx2UHR0RFNoSjJwYlBXK1lNZVIvS2VEaXFady9LZUdtZ2pKY295bmdCSkNQZXRjNmdENk9NbDYxdEdZYzdZMW9GOTNrRWxJeVc4Y01LakEya0UyVzhJTm9pdnFkUXhvdTJ1MnVyWHNWOURnRWwvdm9ybkJ2OUdRWEdCcExhR09jK2VvQ1c5clZ6L2ttQmtZRU1kbS8xaExqUEg2REdIN1g0aHdZeWpQdXIzRWNQMEdISFBKZTduOTQ2dmpkblh6NWZNZ1BWTnhVMkI1TGh1U3U0enlBZ0p6YlZ1ZG52NVI4YlNHNndjUlgzNlFPRnArTm5Xcmt6N0IrTmZJcUw2ME9wYjNrUGNnOE9KTGM3R1ptTHIrWEZzZkRlbWM3Ti9rUDJzWUhVTnVNWjhxVk5OcVpOVFZ2Rzd6NzdGYTI5eFRpZHJEV2JGUmdjU092aHpoc3FFZFNKdzErL3dMblpkeXN3T0pCVXZQMnRsSEUrcWYvOFMvOEcrM2g1aTNPenp5Z3dPSkRXUFZrTlA0V1RoLyt1RmM0TmY1Qi9jQ0NwZURwZFNaS3hQTGVlTDdJNmRjL01kNTJiL2FBQ2d3TnBmWmI3YkFJT2d0RjY5ckdCRERZOHpIMzBRUDVJYnpXdWNRWjg0RUlWZGVlUFpyK3V3TmhBWWxOaDN6cnVNd280Q0VTZjV4OGJTQ3grOTE0aWRNWDArYzV3bjh6MVoxTHRheXJmNEI0YlNEM3U1a0I3cllrWHg4aWpicHFHZ2w2aWVHSmRrZU8rbXp0dEdSK002M2ZRY1gydy9VYnZJZTdCZ2VSMm9xQ1h5R2hCZjBTQndZR1U0bG56Ull2N3pIRGIwbCtkeUVOTzdFMUdkekppSmhVWUhFanI0ZGJyNSt2Y1p4ZFFNMXJRWjlnSEIxSjdZT1FOZ2FDb2NENnhiNXZVVTh3ZXJqanEzT3hQS3pBNGtOYmRLT2dsNG8rdTFGRFF5OU45UXlBb0d0SngvWlo4UEtiMDFJYVo3Z051aGhtSEJqTFlGdlp0NHo3RGdBTVU5Rkxkd24zMHdJWHBqcFZmNFF4emY3NmVROTd4dzYvZ0ViVUNiUXVaZGR4bkdYRGdiL3kxQW1NRHFmVkhjY0Vyek9sWXVla01jbnUraHYzVGduNzFwVzl6ancwa3R4OEZ2VWhRMEF1MVgxdlVnQXRlUWJJN3RMSjBRaitVNzJFZk1hYjNKMi93ZnFqQTRFQmFPejhKei9GeG4yMUF6V2hCMzZ6QTRFQmFPN1ZnRkJlOFlqZ2ovRXBCaHYxc1FmOWtlVWN5WW5Zb01EaVEwb2kzQ1FXOVJBSU5pelFVOVBMMFI1dTArUnR4d1N0Q0p1SFpWTWhoUDJ2WGd4WHVwL2QrOXNHQjFPN21QdU9BQXhUMFVuVXZlUHhraHBtZWhMSEdHZDVoaW5GMzdheWZoYisvQ3pRVk5pM3VzdzQ0Q0VUdlVXQnNJTFgrS0Y0NndjaFlHWCtHYXRqUDJ2SDlPYTl4ancya0Z3VzlWUHpSbmV4akF4a0d2aEV2bldBZy9jeXMyYzdRdGxBUCs1akRxVzk1RDNLUERTUzN2MjM1dkdYY1p4K1E0eGIwRGZ2Wnh3WlNPekR5ZW1CQVJuYVhOczIyOVAxTXd6Nml2Y1U0bmFvMS82ekE0RUJDVTJFemhZSmVJa3Z2bnEyaG9KZG85OGpqaVFFSmFjdXprM1BZUHgzNEo4cVR5YkRYNWg0Y1NHekUyM1QwcG9WNEpMVTRVTkJMOWNqSXp5TkJRVWxieGwzY28vNVp1KzYvNkpEN3lsRDJ3WUdrcGlJbUhra3RrdEdDZmtpQndZRzA3aDM1OHd3b0NEMld2c0laMUVIdVFmKzhKOWRmakhmQXkzUXo5elVCT1BBMzNLL0EyRUI2bitjK2VxVkkxMWE5eWhuU2J1NGhQNWNkTjZPZ0YybkV1NWI3MmdBY29LQ1hxZnR5SVpBM1dyZHJ1bTBaaDdrSC9Mekc5YUhVTjcxTjdHTURxZTFEUVM4U0ZQUkNIUno1MHd6SUN4bEwzODArM2psb2J6WXl5VnF6V1lIQmdZUzZCWDE3Mkt6a3ZrNEFOU2pvcFpvWmlTdkJwS0I2dEd5KzdINjg0bVBuaHQvRFBUaVExcmF3ZVFBRnZVUkdDL3BlQlFZSDB0bzg4cDg3TUNFeThmTFZhY0pIeStadDRPK1orVWZuaGovSVBUaVFWaFQwVWdrMHJOWlEwQXUwWWI5MmRYUTY5L0VyTm5waVpZdWNvZXpsSHVxSjJ2bDNGLytPZTJ3Z3ZXMGgzNVBjMXc3Z0lCamR5RDgya054ZzlDWHVvMWRNakQxYXRwbDdvQ2RyKzNmbi9KNTdiQ0M1d3lqb3BlTGU2TG5IQnRMcmp6N0NmZlNLQVJVZUxaczM0L3BBNnNaTDMxRmdjQ0N0ZmUxaHM1cjdXZ0xVdUYvUm9xQ1g2UERJbjJiQWVYR0cvWmZzbzV4SDdjM0d5V1RFYkZGZ2NDQ3RMU2pvSmVKR1Z2NW9pd0tEQTJudDFhb2I4VC82YzVDeFBPdTR4N2dRZGoxYThaRnpzODhvTURpUVVCVDBVbkZ2OGlqbzVlbitwMjdoZXZ5UC9uTmtMS1BHR2NJQjdpRXVsQ2QvUFBOTjU0WS94RDA0a0ZZVTlGSkJRUy9WQTlyQ2UvRS8rakhPYkROOHpnQjJjZzl3b1QzeHcwditoWHRzSUlNaDh6SHVhd3h3RUlnK3BNRFlRR3FEVWZ5UFhodDl0R3c2b1IvaUhsNHEyNy90M2NjK05wRGE0VlRZaDk1R0pDam9wYnFGKytoeFkxdjZxOXlEUzJwYzcwdXR4RFBvQmRxTGdsNGlLT2psNm8vV2NSOC9MaklKenhiMnNXWFEzbVIwSkNQZU5nVUdCOUtLZ2w0a284K2dQOFkrTnBCaDRCdXY0VDUrMVBRa2pEWGNJOHRwOThNVjc3bWY1aFFZSEVpb1c5Qy9jN1dHSjFhS0F3VzlWRHUxWU5USGZmeW82STZWWCtFTVhCLzN3SExiZGZmTU41THVFODBVR0IxSU9mQmVQTEZTSktNRi9iQUNnd01wOVVlYnRQa2JkZTdqVjJoNlloZk5jWWF0blh0WVZmRkUzWnpmY284TlpEQmlQc3g5TFFJT2d0RkgyY2NHY3JqYitkZWZ3bjM4Q2tWMmgxYVdqdXNIdVFkVk1ZZFQzN3IwRGZheGdkUU9vYUNYQ2dwNnFXN2pQbnFGd2hteVZ4UVlVL1dNNmIxdE4zamZVMkJ3SUswbzZFVXlVdEJIRHlnd05wRGFFaXpvMHduUEUrd2pxckQyVTBaYk1tUjJLREE0a05hVzQ2SExabk5mbjRBYTl6R2xlQWE5UlB1MVJRMDEzTWN2WDR5VjhjUGNBNnE2WFE5VnVMOS83MU5nY0NDcDN2MG82Q1dDZ2w2cW5kcVNEVlhjeDIreTlDWm1CTk1vNDNQMlZNT3MxL2pIQmxLTGdsNHFLT2lsZWxpcjNsREJmZndteWxnWjM4bzltTVZtK3kxZjJjTTlOcERlVk5qM0FQYzFDemdJUkI5WFlHd2d1WTE3dENJczZMTXZhTk5SeGsvWW9lU3FTLy9BUFRhUTNLRzJXbk1sOTdVTE9IQmZOc0krTnBCY2YvUlo3cU0zWHB5QmVsbUJrU3hldHhpOXlWcnZCd29NRHFRMTB4YWF0NGo3K2dYVXVLOEpSVUV2VTMvak91N2pseXQyUW4rSWZSeExRUHNuNWNkUjBJdTBHUVc5UkZEUVMzV2dHQXI2ZEx4c2xUTk1ROXpEV0NxT0ZmVDlDZ3dPSk5XN1AxdW5UZU8rbmdFMW93Vjlud0tEQTJsVnVxRFBKTXErNWd6U2FlNUJMRFZQM25ueDcvbkhCdExyMjhsOVRRTU8vQTFyTlJUMEVsV3lvRTgvTTJ1Mk0wUWZjdzlocWRyK1BSVDBNdlhleTMxdEF3NEMwWjhvTURhUVhMZWdqMDNsUG41bkdTbmpMZjF0N2dFc2NRZFRxeTU5aTM5c0lMR0RLT2lsZ29KZXFqL25QbnBuU2FPTXAzR0xrVW5XK2o1U1lIQWdyU2pvUllLQ1hxNEtGUFIyUXQvSVBucUN0SitvK05pNTJaOVVZSEFncmMxZDExMHlrL3Q2QjlTNEJYMGdtbUlmRzBqdGdPYS9hd1hYc1VNWnoyUFhBeFh2cE1MbWdBS0RBd2xOaGN5OUtPZ2xVdDJ3VEVOQkw5RnV6VisvZ1BxNG9Zem45ZVR0Ri84ZjdyR0JESWJNWDFGZjYwQUZVTkJMOVFobFFUOVd4aC9qSGpqcGR2eVh5bjloSHh2SW9MZWU2bG9IS2hHTWJsSmdiQ0M1TkFVOXluaUZqT3VEeVc5NjhReDZlYUtnRndzS2VwbjZvLzlZNktPVlJobXZsUFlXdzNadTlCOHJNRGlRMWt4SHhFdis1empBalZ2USs2Tk43R01ENlExR0MvYVZuVzNwRDNLUEdmeWkzWStWTjdzM2V3VUdCOUo2QkFXOVJJSlJuNGFDWHFLRGhTam9VY2FyN2FrZnp6em8zT3dIRlJnY1NPaElRYTlweWp6UUNsQ0JnbDZxZVMzb1VjWVhoeWQvaElKZXBCSGZML04xcllOaVlyU2c1eDRiU084UmJlRzlrLzdLRG1WOGNkbitsNVY3MmNjR01vaUNYaWFCNkJZRnhnYlN1MWZUNmliODBBdVU4VVZvWEI5SXJmUTI4WThOSkhZd0daN0w5a0Fyd0VrZ3VsdUJzWUgwUGovUkk1TkdHVitVMnB1TWs4bUllVnlCd1lHMGRxT2dsOGo4alRvS2VxRk9vS0MzRS9wRDNDTUZKMjczb3hWSG5adDlyd0tEQTJrOTBubERwWEt2aEFhRkJnVzlWQWVkLzlqbC9OQUxsUEdsNGFtN1o3b1B1QmxTWUhBZ3JYdFEwRXRrdEtEdlYyQndJSzBaTGRCd3dkZEc5aVptQk5NbzQwdkdFeis0NUY4VkdCdEliQ3BzUGtjeEowQTEvTkU2QmNZRzB0dDh2b0wrOUxaeXJ6TUl4N2tIQ2ViWDFPcEwzK0llRzhneDhENzJWMElERGdLTmNRWEdCdEo3em9MZUdZSjN1SWNJRnNDWS9uOVRLNzN2YzQ4TnBCNTM5N1hBS09obGdvSmVwdjdvenM4ZmhYVGM4OS9ZUndnV1RQc3A0MFF5WW5ad0R3NGt0enNabVZ2Rk1TK0FFeFQwa3IzbjdER3dMU1BCUFQ2dzhIWS9WUEdmenMyK1Q0SEJnYlFlUmtFdmtkR0N2bE9Cc1lHMERsNSt3eDJlakdYOE0vZm9RRHBQTmM3NmR3WEdCdExyRnZSVHVPY0dVTE9vb1VaRFFTL09XVXZ2eUhSdUtXL21IaHhJYStjdFgvbXhBbU1ENmYwSDdxa0JIS0NnRittaWEvK214YmIwSHU3QmdUVGFsbkU0dmRXNEpoVXhkeWt3TnBCWUZQUlNDVWEzY284TnBIZnRxdSs4eXowNmtNQ0U1NzJ1bURieVU4aWpOeTBzUzBid0RIcHB1Z1Y5ZTYxWnd6MDFnSjRwR2dwNmtUNno3cXA5N09NREM2WnQ2U2s3NXJuOHN4ZjdKK0U1UHVkbW4rSWVIRWh1SndwNmlhQ2dGK3RiRDg1OWszdUVZRUhzNjQ2VlgvRmxsM3ZiOG5uTGtpam9KWHE0OWZyNU92VzhBRzVRMEl0MGVuWDl3Q2RQelRxa3dCakIvRG5ja3pEV25POXlUMGE4YXhVWUcwanZiaFQwRWtGQkw5Skxycnk5dXl0dUpCVVlKWmdQRTU0bmM3bmNreUZ6aXdKakE0bHRDL3VlTHZTVUFCVkJRUy9TWmN0dk9Xcmo1VEdsNEN2anVkeFIwTXUwTFdUV0ZXcENnTW9FR3AvbUhodEliOTEzVmgxMHhtRllnWUdDRXpHdUg4enUwTXJHYzZtam9CZHJQd3A2bWFDZ0Yrby8zYkhrTmZhUmdoT3h0U2QyMFp5SlhPd282TVhhNmY3YjUzczhnT3E0QlgwZ2VwaDdiQ0M5QngvMnZxM0FXTUhjN2V0TnpBaE81bkpIUVMvVWlMY0pCYjFFbG15bzBsRFFpN05zOFozOXJadG12cS9BYU1FTGU4RXlQbGRRMElzVkJiMUlSZ3Y2QWU3QmdiUldMcnZ0VkZmYzZGQmd2T0Q1VEhpZXlPZmw3dHpvTnlzd05wRFlWTWlieU9jNUFzV0N2M0VkOTloQWVxOExmZjlEWjBENjJBY01uc3R4bGZHNWdvSmVwaWpvcGVKditDbjMyRUI2NzFpejh0OFVHREg0ZVNkUXh1Y0tDbnF4OXJ2dFJTSE9GRkNiS1ZxZ2NRLzMyRUI2WDJyd3Y4WStadkN6VHJpTXp4VVU5REoxLzgxUjBFdWtla09GaG9KZW5GTUMwZUgvZUd3T1BzR3I0YVRMK0Z4QlFTOVVGUFJDUVVFdlVyMjZ2cTlqUzhWUkJjWk5zbmtyNDNNRkJiMVlkMU9lTTZBS0tPaEZldG5WdHlhNzQ4WXBCVVpPcUo3SE9TNzN0ckM1U1lHeGdkU0d6QzBjNXcxd2c0SmVwT0hhdGU3djN3ZjRoMDZjQlNuamN3VUZ2VkFqM3JXYzV3NXdFV2o4R2ZmWVFIb2YvdXZsZUFjOHBRVXM0M01GQmIxWSsxRFFpeVEyRlFXOVRIZHYrT28rOXRHVFljSEwrRnhCUVM5VEZQUlNRVUV2MHFuQmhxRVBuL2pLUVFYR3I1VHQ2NDNOcU9hK3hEOExDbnFoUnJ4TjdyYzMzT2NQVUROYTBIZHpEdzZrdFh6Sit0T2RXOHFiRlJqQlVuVFlUaGhLL3IxenJLQWZaaDhjU0tyYlhYQ2ZQY0NCLzY0VkdncDZjUzY4OW9jdHRtVmtGQmpEMGpMaGVaTDdrajRmS09obDJoYnhQY1Y5OWdBSEtPaEZ1bmJWZDk1MUJtbVFmUkJMeDZMNGhJU0NYcVRES09pbEVtaDRqbnRzSUwzYmJyM3FkUVZHc2ZoTjZFM2NaWHl1dUgrRGRUN0JIMUJnY0NDdEtPaGxnb0plcXY5Nlg5VWI3T05ZeE5xV25qcXp6U2lxS3JrOWJGYWlvSmVuKzIvdS90dHpuejlBeldoQmY0UjdiQ0N0MDRJTmc1ODhOZXNROTBnV3FmMTJyTHdvUHcyaG9KZXArNjBOQ25xSitPc1hhQ2pveFhuSmxiZDNuNHlWdHlnd2xzVmxYQy9xZDJtam9KY3BDbnFwb0tBWGFmVTNmdEJzVy9wcDlzRXNGdVBHVnU1TE5SKzRKVFgzMkVDT2dmZXl2UE1BY0lPQ1hxUjEzMW5sUHVCbWlIMDRGVGRqNmJ1eldXMEs5MldhTDFEUWkzUTRGZmF0NWo1N2dJTmc0eSs0eHdiU3UrT09wWGhFN1htMExlTnc2M2F0cE42YmpZSmVyTDN0WVZPcHB5a0NFdHlDUHJxWGUyd2d2UWNmOXI3TlBhS0sydG0xVmEvaXZqSUxBUXA2c2JhZ29KZkl3bnRuYWlqb3hWbTIrTTcrMWswejMxZGdURlZ5SUdNWk5keVhaQ0ZCUVM5VDkxdWJkNjdXcG5PZlAwQU5DbnFSVmk2NzdWUlgzT2hRWUZTVk1HTjUxbkZmaWhTZ29KZHBXOWo3RXZmWkF4eU1GdlNEM0lNRGFiMHU5UDBQbldIcjR4NVdiak54ZlR2M0pVaEpXOGozSlBmWVFCWWY0VDU3Z0lOZ3RKNTdiQ0M5ZDZ4WitXL2M0OHJzM214TW04cDkrVkdEZ2w2a1F5am9wUkpvMk1FOU5wRGVmNjRQdktiQXlISjRwQ3VtemVTKzdMaEFRUy9TMHlqb1JZS0NYcXJ2UG5LcHNJTGV5S1FUbmdYY1Z4d25ia1h0M094YkZCZ2NTR3ZMOGRCbHM3blBINkFHQmIxSTNZSSt0Zm1pLytRZlhSSUhiY3RUeTMycHFZRDdLYzY1MmZjcU1EaVFWTzkrRlBRU0dTM29NOXlEQTJtZCsvVjFIUklLZWp2dVdjOTlpYW1FKzNkWTU0WS94RDg0a0ZJVTlGTHhSMWRxS09qRldSUDZ2dnZwdlpRTCtsOXpYMW9xMGhieVBjZzlOcEJqNEgwYnVjOGU0QUFGdlVqLzdyczMvcnNDSTF3STkyVjNhZE80THl0VlNZWjlPN25IQnBLTGdsNHNnZWl2dU1jRzB2dmluY0hYRkJqamZIcE1jaG1mQzlrNmJWb3FaTzVWWUhBZ3JiMXRvWG1MdU04ZklLZHVtb2FDWHFTbFU5QWJtVXlpN0d2Y1YxSXgwSFhkSlRPZG0vMFJCUVlIMHRxTWdsNGlvd1Y5TS9mWVFGcExwS0FmUWhrL1Bqb2kzZ1hPelQ2andPQkFVcjM3M1c5dnVNOGZvQ2JRc0VoRFFTL09ZaS9vTTVaK0gvZWxVNHkwMVpvcm5SditJUC9nUUZwOU83blBIdUFBQmIxSWk3YWdUeGd2Y2w4eXhZenpTYTZlZjJ3Z3RhbVFGLzhoRmtrZ2VnLzMyRUI2aTdDZ2Z4dGwvT1JKaGMzbnVNY0dranZrZm5QRGZmWUFCLzdvVHU2eGdmUVdVVUYvTFAzTUxNUkJlU0NyYVZPZG0vMGVCUVlIMHBwQlFTOFNGUFJTTFlLQy9qVEsrUHpTZVVObGhYT3pQNnpBNEVCYW05MWZUM0NmUDBBTkNucVJLbDdRRDZYalphdTRMNDFTSkJtWlcrWGM3RHNWR0J4SXFQdmNBeFQwRWtGQkwxSlZDM3JiMGgva3ZpUkttZlphczhhNTRmZHpEdzZrRmdXOVRFWUwraUh1d1lHMEtsalF2OHg5S1VpZ0xXVFc4WThOSkRka2J1QStlNEFEZi9RKzdyR0I5Q3BVMEwrZGZRR3ZyNlRDdWRGdllSOGJTTzBnQ25xcG9LQVhxUUlGZlN2S2VIcFNFWE9YQW9NRGFjMjRUeS9rUG51QUhMZWdiOWpQUFRhUVhzYUMvblJ2WWthUSsrUkw1T2hOQzh2YXd1WUJCUVlIMG5vRUJiMUVsdDQ5VzBOQkwwNm1naDVsUERQdFliUFN1ZG0zS0RBNGtOQ1JnbDdUcG5LZlAwRE5hRUhmeXowNGtGYnlnajVoM00xOTFNSEl3RmM3Ti94ZTdzR0I1TzdnUG51QWcwRERhZzBGdlRpcENubzdydVBHb2hDcHNHKzFjN01mVW1Cd0lLbmVldTZ6QnpnSVJoL2dIaHRJYitFTGV1TjMyUmkrRWxTTnRyQnZJLy9ZUUdJSGsrRzVLN2pQSHVBZ0dIMkplMndndllVcjZJMFBPbjZtbFhNZmEvRGx1QTg3VVdCd0lLM2RLT2dsY25WME9ncDZtUmFnb0cvdml1bnp1WTgwT0RmdVkwcmQyRXFCd1lHMEhuSGZQOEI5L2dBMUtPaEZtdWVDdnE4N1ZuNEY5MUVHRjhiOW1aUjdzMWRnY0NDdGUxRFFTd1FGdlVqelZOQVA5eVNNTmR4SEdPU08reld0YzdQdlZtQndJS0dwc0hjNzk5a0RIS0NnRitsa0MzbzdvVC9FZlhUQitIRkRxMVRZSE9BZUhFZzk4TDUxM0djUGNCQ0lQc1E5TnBEZXNZSitlTnpqbmpCZTVENnlZT0s0TjNydXNZSFU0KzcraHc0RnZVeFEwSXQwQWdYOXZ1d3V2RWU2MkVtRnpKOXpEdzRrdHpzWm1WdkZmZllBTlNqb3hacDdRVzk4MEJYVDhQenFFc0NOckp5Yi9SNEZCZ2ZTZWhnRnZVVGNndDRmYmVFZUcwaXJXOUMzYnBwNStBTGpmaEkvZVNzdDNKdThlN05YWUhBZ3JTam9SVkxkV0syaG9CZG41YkxiVHAybm9POVBield1NFQ2YUlQKzRYOU02Ti90T0JRWUgwdm96N3JNSE9FQkJMOUp6RlBURDZiaCtDL2VSQklXanZkYXNjVzcyL1FvTURpUVVCYjFVL05GSHVNY0cwdnZGZ3Q3ek9QZFJCSVduTFdUV2NZOE5wQjUzYzhEOWp4MzMyUU1jb0tBWDZYOWYvMmxCL3pMM0VRUjBPRGY4emR5REE4bnRSRUV2bFVEME40NzdvRENCU0pJUjN5L2J3dVkrS01ka3hQejEvd05Gb0oyQXJYTHJoZ0FBQUFCSlJVNUVya0pnZ2c9PSIvPgoJPC9kZWZzPgoJPHN0eWxlPgoJPC9zdHlsZT4KCTx1c2UgaWQ9IkJhY2tncm91bmQiIGhyZWY9IiNpbWcxIiB4PSIwIiB5PSIwIi8+Cjwvc3ZnPg=='
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
                N('div', 'Copyright © Construct-X', { class: 'copy' })
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
