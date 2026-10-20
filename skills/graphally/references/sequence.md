# Sequence diagrams

`<diagram layout=sequence>`: participants across the top, messages in time order down the
page. Add `numbered` to number the steps.

```html
<diagram layout=sequence numbered title="Sign-in">
  <node id=user icon=user>Dispatcher | browser</node>
  <group id=azure label="Azure">                 <!-- optional box behind some participants -->
    <node id=app icon="app service">Web app</node>
    <node id=entra icon=entra>Entra ID</node>
  </group>
  <links>
  user -> app : GET /orders
  app --> user : 302 to Entra ID
  user -> entra : sign in | authorization code, PKCE
  note app : validates nonce
  alt token valid
    app -> app : render
  else expired
    app -> entra : refresh token
  end
  app ~> entra : audit event
  </links>
</diagram>
```

| Line | Draws |
|---|---|
| `a -> b : text` | call (solid); opens an activation bar on `b` |
| `b --> a : text` | reply (dashed); closes `b`'s bar |
| `a ~> b : text` | asynchronous message (open arrowhead, no bar) |
| `a => b : text` | the highlighted message |
| `a -> a : text` | self call |
| `text \| more` | second line under the arrow |
| `note a : text`, `note a, b : text` | note over one participant or spanning several |
| `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`, `break` … `end` | fragment around the messages it contains; text after the keyword is the condition |

Order participants left to right in the order they are first used. Keep message text to a
few words; put detail on the second line.
